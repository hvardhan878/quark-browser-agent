import { ManifestV3Export } from '@crxjs/vite-plugin';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'Quark Browser Agent',
  version: '0.1.0',
  description: 'AI-powered website customization through natural language',
  
  permissions: [
    'activeTab',
    'scripting',
    'storage',
    'sidePanel',
    'webRequest',
    'tabs',
  ],
  
  host_permissions: [
    '<all_urls>',
  ],
  
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  
  action: {
    default_title: 'Open Quark',
  },
  
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  
  web_accessible_resources: [
    {
      resources: ['icons/*.png'],
      matches: ['<all_urls>'],
    },
  ],
};

export default manifest;

