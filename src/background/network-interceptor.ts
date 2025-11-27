import type { CapturedRequest, APIEndpoint, APICategory } from '../shared/types';
import { getDomainFromUrl } from '../shared/messaging';

export class NetworkInterceptor {
  private requests: Map<string, CapturedRequest> = new Map();
  private endpoints: Map<string, Map<string, APIEndpoint>> = new Map(); // domain -> path -> endpoint

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Capture outgoing requests
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.onBeforeRequest(details),
      { urls: ['<all_urls>'] },
      ['requestBody']
    );

    // Capture request headers
    chrome.webRequest.onSendHeaders.addListener(
      (details) => this.onSendHeaders(details),
      { urls: ['<all_urls>'] },
      ['requestHeaders']
    );

    // Capture response
    chrome.webRequest.onCompleted.addListener(
      (details) => this.onCompleted(details),
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );
  }

  private onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): void {
    // Only capture XHR and fetch requests
    if (details.type !== 'xmlhttprequest') return;
    
    const request: CapturedRequest = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      headers: {},
      body: this.extractRequestBody(details.requestBody ?? undefined),
      timestamp: details.timeStamp,
      type: 'xhr',
      initiator: details.initiator,
    };

    this.requests.set(details.requestId, request);
  }

  private onSendHeaders(details: chrome.webRequest.WebRequestHeadersDetails): void {
    const request = this.requests.get(details.requestId);
    if (!request || !details.requestHeaders) return;

    request.headers = this.headersToObject(details.requestHeaders);
  }

  private onCompleted(details: chrome.webRequest.WebResponseCacheDetails): void {
    const request = this.requests.get(details.requestId);
    if (!request) return;

    // Parse and store as endpoint
    this.processEndpoint(request);

    // Clean up request after processing
    this.requests.delete(details.requestId);
  }

  private extractRequestBody(body?: chrome.webRequest.WebRequestBody): string | undefined {
    if (!body) return undefined;

    if (body.raw) {
      try {
        const decoder = new TextDecoder();
        const parts = body.raw.map(part => {
          if (part.bytes) {
            return decoder.decode(part.bytes);
          }
          return '';
        });
        return parts.join('');
      } catch {
        return undefined;
      }
    }

    if (body.formData) {
      return JSON.stringify(body.formData);
    }

    return undefined;
  }

  private headersToObject(headers: chrome.webRequest.HttpHeader[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const header of headers) {
      if (header.name && header.value) {
        obj[header.name.toLowerCase()] = header.value;
      }
    }
    return obj;
  }

  private processEndpoint(request: CapturedRequest): void {
    const domain = getDomainFromUrl(request.url);
    if (!domain) return;

    try {
      const url = new URL(request.url);
      const path = this.normalizePath(url.pathname);
      const endpointKey = `${request.method}:${path}`;

      if (!this.endpoints.has(domain)) {
        this.endpoints.set(domain, new Map());
      }

      const domainEndpoints = this.endpoints.get(domain)!;
      const existing = domainEndpoints.get(endpointKey);

      if (existing) {
        existing.callCount++;
        existing.lastCalled = Date.now();
        
        // Update query params if new ones found
        const queryParams = this.parseQueryParams(url.search);
        existing.queryParams = { ...existing.queryParams, ...queryParams };
      } else {
        const endpoint: APIEndpoint = {
          url: request.url,
          method: request.method,
          baseUrl: `${url.protocol}//${url.host}`,
          path: url.pathname,
          queryParams: this.parseQueryParams(url.search),
          authType: this.detectAuthType(request.headers),
          callCount: 1,
          lastCalled: Date.now(),
        };

        // Try to parse request body schema
        if (request.body) {
          try {
            const parsed = JSON.parse(request.body);
            endpoint.requestSchema = this.inferSchema(parsed);
          } catch {
            // Not JSON
          }
        }

        domainEndpoints.set(endpointKey, endpoint);
      }
    } catch {
      // Invalid URL
    }
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and numeric IDs with placeholders
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
      .replace(/\/\d+(?=\/|$)/g, '/{id}');
  }

  private parseQueryParams(search: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(search);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  private detectAuthType(headers: Record<string, string>): APIEndpoint['authType'] {
    if (headers['authorization']?.toLowerCase().startsWith('bearer')) {
      return 'bearer';
    }
    if (headers['x-api-key'] || headers['api-key']) {
      return 'api-key';
    }
    if (headers['cookie']) {
      return 'cookie';
    }
    return 'none';
  }

  private inferSchema(obj: unknown): Record<string, unknown> {
    if (obj === null) return { type: 'null' };
    if (Array.isArray(obj)) {
      return {
        type: 'array',
        items: obj.length > 0 ? this.inferSchema(obj[0]) : { type: 'unknown' },
      };
    }
    if (typeof obj === 'object') {
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        properties[key] = this.inferSchema(value);
      }
      return { type: 'object', properties };
    }
    return { type: typeof obj };
  }

  public getAPIsForDomain(domain: string): APICategory[] {
    const domainEndpoints = this.endpoints.get(domain);
    if (!domainEndpoints || domainEndpoints.size === 0) {
      return [];
    }

    const endpoints = Array.from(domainEndpoints.values());
    
    // Categorize endpoints
    const graphqlEndpoints = endpoints.filter(e => 
      e.path.includes('graphql') || e.path.includes('gql')
    );
    const restEndpoints = endpoints.filter(e => 
      !e.path.includes('graphql') && !e.path.includes('gql')
    );

    const categories: APICategory[] = [];

    if (graphqlEndpoints.length > 0) {
      categories.push({
        name: 'GraphQL',
        endpoints: graphqlEndpoints,
        type: 'graphql',
      });
    }

    if (restEndpoints.length > 0) {
      // Group REST endpoints by base path
      const pathGroups = new Map<string, APIEndpoint[]>();
      for (const endpoint of restEndpoints) {
        const basePath = endpoint.path.split('/').slice(0, 3).join('/') || '/';
        if (!pathGroups.has(basePath)) {
          pathGroups.set(basePath, []);
        }
        pathGroups.get(basePath)!.push(endpoint);
      }

      for (const [basePath, groupEndpoints] of pathGroups) {
        categories.push({
          name: basePath === '/' ? 'Root API' : basePath,
          endpoints: groupEndpoints,
          type: 'rest',
        });
      }
    }

    return categories;
  }

  public clearDomain(domain: string): void {
    this.endpoints.delete(domain);
  }

  public clearAll(): void {
    this.requests.clear();
    this.endpoints.clear();
  }
}

