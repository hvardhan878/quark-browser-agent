# Quark Browser Agent

AI-powered Chrome extension that understands website APIs and allows you to inject custom scripts via natural language prompts.

## Demo

See Quark in action: understand website APIs, generate scripts with AI, and customize any website through natural language.

<video width="100%" controls>
  <source src="demo/demo-quark.mov" type="video/quicktime">
  Your browser does not support the video tag. <a href="demo/demo-quark.mov">Download the video</a> to view it.
</video>

> **Note**: If the video doesn't play inline, [download it directly](demo/demo-quark.mov). For best GitHub compatibility, convert to MP4 format - GitHub will auto-embed MP4 videos.

## Features

- **API Discovery**: Automatically captures and categorizes network requests to understand website APIs
- **DOM Analysis**: Analyzes page structure to identify interactive elements and data containers
- **AI Script Generation**: Uses OpenRouter to generate JavaScript code based on natural language prompts
- **Script Management**: Save, edit, enable/disable, and export scripts per domain
- **PM Export**: Export API documentation and scripts for development handoff
- **Model Flexibility**: Switch between different AI models (Claude, GPT-4, Llama, etc.) via OpenRouter

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))

### Installation

1. Clone the repository:
```bash
cd quark-browser-agent
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Development

Run the development server with hot reload:

```bash
npm run dev
```

Then load the extension from the `dist` folder in Chrome.

## Usage

1. **Configure API Key**: Click the Quark icon, go to Settings, and enter your OpenRouter API key

2. **Browse a Website**: Navigate to any website you want to customize

3. **Open Quark**: Click the extension icon to open the side panel

4. **Chat with AI**: Describe what you want to do in natural language:
   - "Hide the sidebar"
   - "Block all API calls to /analytics"
   - "Add a dark mode toggle"
   - "Extract all product prices from this page"

5. **Review & Execute**: Review the generated code and click "Run" to inject it

6. **Save Scripts**: Generated scripts are automatically saved per domain

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Chrome Extension                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Network    │  │     DOM      │  │  Side Panel  │   │
│  │ Interceptor  │  │   Analyzer   │  │   (React)    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│          │                │                  │           │
│          └────────────────┼──────────────────┘           │
│                           ▼                              │
│                ┌──────────────────┐                      │
│                │ Site Context     │                      │
│                │ Engine           │                      │
│                └────────┬─────────┘                      │
└─────────────────────────┼────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  OpenRouter API  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Generated Script │
                └──────────────────┘
```

## Project Structure

```
src/
├── background/           # Service worker
│   ├── index.ts          # Main background script
│   ├── network-interceptor.ts
│   └── openrouter-client.ts
├── content/              # Content scripts
│   ├── index.ts
│   ├── dom-analyzer.ts
│   └── script-injector.ts
├── sidepanel/            # React UI
│   ├── App.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── ApiExplorer.tsx
│   │   ├── ScriptManager.tsx
│   │   └── SettingsPanel.tsx
│   └── hooks/
│       └── useSiteContext.ts
├── shared/               # Shared utilities
│   ├── types.ts
│   ├── storage.ts
│   └── messaging.ts
└── lib/                  # AI utilities
    ├── prompt-templates.ts
    └── context-builder.ts
```

## Use Cases

- **Power Users**: Customize websites, hide elements, add features
- **Legacy Tool Integration**: Add API connections to tools without native support
- **Third-Party APIs**: Connect external services to websites
- **PM Prototyping**: Test feature ideas before handing off to developers

## Security Notes

- API keys are stored locally in Chrome storage (never synced)
- Scripts require explicit user approval before execution
- Scripts are isolated per domain
- Generated code runs in the page context (MAIN world)

## Tech Stack

- **Extension**: Chrome Manifest V3, TypeScript
- **UI**: React 18, Tailwind CSS
- **State**: Zustand
- **AI**: OpenRouter API
- **Build**: Vite + CRXJS

## License

MIT

