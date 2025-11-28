import type { OpenRouterConfig } from '../shared/types';
import { buildSystemPrompt, buildUserPrompt, type EnhancedContext } from '../lib/prompt-templates';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface GenerateScriptResult {
  code?: string;
  name?: string;
  description?: string;
  explanation?: string;
  error?: string;
}

export class OpenRouterClient {
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  // Check if the model supports vision
  private isVisionModel(): boolean {
    const visionModels = [
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'openai/gpt-4-vision',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-haiku',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-pro-vision',
      'google/gemini-1.5-pro',
      'google/gemini-1.5-flash',
    ];
    return visionModels.some(m => this.config.model.includes(m.split('/')[1]));
  }

  async generateScript(
    userPrompt: string,
    siteContext: EnhancedContext & { screenshot?: string }
  ): Promise<GenerateScriptResult> {
    try {
      const systemPrompt = buildSystemPrompt(siteContext);
      const fullUserPrompt = buildUserPrompt(userPrompt, siteContext);

      // Build user message content - can be string or array for vision models
      let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      
      if (siteContext.screenshot && this.isVisionModel()) {
        // Use multimodal format for vision models
        userContent = [
          { type: 'text', text: fullUserPrompt },
          { 
            type: 'image_url', 
            image_url: { url: siteContext.screenshot } 
          },
        ];
        console.log('[Quark] Sending request with screenshot to vision model');
      } else {
        userContent = fullUserPrompt;
        if (siteContext.screenshot) {
          console.log('[Quark] Screenshot provided but model may not support vision:', this.config.model);
        }
      }

      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://quark-browser-agent',
          'X-Title': 'Quark Browser Agent',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 4096,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          error: `API Error: ${response.status} - ${errorData.error?.message ?? response.statusText}` 
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { error: 'No response from AI' };
      }

      return this.parseResponse(content);
    } catch (error) {
      return { error: `Request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private parseResponse(content: string): GenerateScriptResult {
    // Try to extract structured response
    const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    const nameMatch = content.match(/(?:Script Name|Name):\s*(.+)/i);
    const descMatch = content.match(/(?:Description):\s*(.+)/i);

    const code = codeMatch?.[1]?.trim();
    
    if (!code) {
      // If no code block found, try to extract any JavaScript-like content
      const lines = content.split('\n');
      const codeLines = lines.filter(line => 
        line.includes('function') || 
        line.includes('const ') || 
        line.includes('let ') || 
        line.includes('document.') ||
        line.includes('window.') ||
        line.includes('fetch(') ||
        line.trim().startsWith('//')
      );
      
      if (codeLines.length > 0) {
        return {
          code: codeLines.join('\n'),
          name: nameMatch?.[1] ?? 'Generated Script',
          description: descMatch?.[1],
          explanation: content,
        };
      }
      
      return { error: 'Could not extract JavaScript code from response', explanation: content };
    }

    // Extract explanation (everything outside code block)
    const explanation = content
      .replace(/```(?:javascript|js)?\n[\s\S]*?```/g, '')
      .trim();

    return {
      code,
      name: nameMatch?.[1] ?? 'Generated Script',
      description: descMatch?.[1],
      explanation,
    };
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<{ content?: string; error?: string }> {
    try {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://quark-browser-agent',
          'X-Title': 'Quark Browser Agent',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 4096,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          error: `API Error: ${response.status} - ${errorData.error?.message ?? response.statusText}` 
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return { content };
    } catch (error) {
      return { error: `Request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  static async getModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.data ?? []).map((model: { id: string; name?: string }) => ({
        id: model.id,
        name: model.name ?? model.id,
      }));
    } catch {
      return [];
    }
  }
}

