# Quark Browser Agent

An **agentic AI Chrome extension** that autonomously understands website APIs, analyzes page structure, and generates custom scripts through natural language prompts. Think of it as a Cursor-like AI assistant, but for any website you're browsing.

## Demo

See Quark in action: understand website APIs, generate scripts with AI, and customize any website through natural language.

![Demo GIF](demo/demo-quark.gif)

## What Makes It Agentic?

Unlike simple AI chatbots, Quark is a **true AI agent** that:

- **Autonomously uses tools** - Decides when to capture snapshots, take screenshots, pick elements, or call APIs
- **Works persistently** - Continues generating scripts even if you close the side panel or navigate away
- **Shows its thinking** - Displays a real-time task list (like Cursor) so you see what it's doing
- **Asks for permission** - Requests approval before running scripts or making API calls
- **Iterates intelligently** - Can refine scripts through conversation, selecting and improving specific scripts
- **Understands context** - Uses multiple tools together (snapshot + screenshot + API analysis) for better understanding

This means you can just say "add a dark mode toggle" and the agent will figure out how to do it, test it, and ask for your approval - no manual tool selection needed.

## Features

### 🤖 Agentic AI System
- **Autonomous Tool Use**: The AI agent decides which tools to use (element picker, snapshot, screenshot, API calls) without manual intervention
- **Persistent Operations**: Script generation continues even if you close the side panel or navigate away
- **Task List UI**: Cursor-style task tracking showing what the agent is doing in real-time
- **Permission System**: User approval required for sensitive actions (script injection, API calls)

### 🔍 Context Understanding
- **API Discovery**: Automatically captures and categorizes network requests to understand website APIs
- **DOM Analysis**: Analyzes page structure to identify interactive elements and data containers
- **Visual Element Picker**: Click any element on the page to get its selector and context
- **Page Snapshots**: Detailed DOM structure capture for better AI understanding
- **Screenshot Capture**: Vision model support for visual understanding

### 💻 Script Generation & Management
- **AI Script Generation**: Uses OpenRouter with function calling to generate JavaScript code
- **Iterative Editing**: Continue conversations and refine scripts through multiple prompts
- **Script Selection**: Focus on specific scripts for iterative improvements
- **Script Management**: Save, edit, enable/disable, and export scripts per domain
- **Conversation Persistence**: All conversations and scripts are saved per domain

### ⚙️ Advanced Capabilities
- **Model Flexibility**: Switch between different AI models (Claude, GPT-4, Llama, etc.) via OpenRouter mid-conversation
- **API Integration**: Agent can call intercepted APIs directly to test endpoints
- **Trusted Types Bypass**: Works on Google sites and other CSP-restricted pages using Blob URL injection
- **PM Export**: Export API documentation and scripts for development handoff

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

4. **Chat with AI Agent**: Describe what you want to do in natural language:
   - "Add a dark mode toggle to this site"
   - "Create a filter for Chinese food on Amazon"
   - "Hide all ads and tracking scripts"
   - "Extract all product prices and export to CSV"

5. **Watch the Agent Work**: The agent will:
   - Automatically capture page snapshots
   - Use element picker if needed
   - Take screenshots for visual context
   - Analyze APIs and DOM structure
   - Generate and test scripts

6. **Approve Actions**: Review and approve script injection or API calls when prompted

7. **Iterate**: Continue the conversation to refine scripts or add features

8. **Manage Scripts**: All generated scripts are saved per domain in the Scripts tab

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
                │  Agent Loop      │  ← Persistent background
                │  (Service Worker)│     agentic operations
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Tool System     │
                │  - capture_snapshot
                │  - pick_element
                │  - capture_screenshot
                │  - inject_script
                │  - call_api
                │  - verify_element
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  OpenRouter API  │
                │  (Function Calling)│
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Generated Script │
                │  (Auto-saved)    │
                └──────────────────┘
```

### Agentic Workflow

1. **User Prompt** → Agent receives natural language request
2. **Context Gathering** → Agent autonomously uses tools (snapshot, screenshot, element picker)
3. **Tool Execution** → Agent decides which tools to use based on context
4. **Permission Request** → User approves sensitive actions (script injection, API calls)
5. **Script Generation** → Agent generates and injects code
6. **Verification** → Agent verifies results and iterates if needed
7. **Persistence** → Scripts saved, conversations continue even if panel closes

## Project Structure

```
src/
├── background/           # Service worker
│   ├── index.ts          # Main background script
│   ├── agent.ts          # Agentic loop & tool orchestration
│   ├── tools.ts           # Tool definitions & executor
│   ├── network-interceptor.ts
│   └── openrouter-client.ts
├── content/              # Content scripts
│   ├── index.ts
│   ├── dom-analyzer.ts
│   ├── element-picker.ts # Visual element selection
│   ├── snapshot-capture.ts # DOM snapshot capture
│   └── script-injector.ts
├── sidepanel/            # React UI
│   ├── App.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── AgentTaskList.tsx # Cursor-style task tracking
│   │   ├── PermissionDialog.tsx # Permission requests
│   │   ├── ElementPicker.tsx
│   │   ├── ApiExplorer.tsx
│   │   ├── ScriptManager.tsx
│   │   └── SettingsPanel.tsx
│   └── hooks/
│       └── useSiteContext.ts
├── shared/               # Shared utilities
│   ├── types.ts          # Agent types, tool types
│   ├── storage.ts        # Conversation & script persistence
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
- **Permission System**: Scripts and API calls require explicit user approval before execution
- Scripts are isolated per domain
- Generated code runs in the page context (MAIN world)
- **Trusted Types Bypass**: Uses Blob URL injection to work on CSP-restricted sites (Google, etc.)
- Agent operations are sandboxed and can be stopped at any time

## Tech Stack

- **Extension**: Chrome Manifest V3, TypeScript
- **UI**: React 18, Tailwind CSS
- **State**: Zustand
- **AI**: OpenRouter API
- **Build**: Vite + CRXJS

## License

MIT

