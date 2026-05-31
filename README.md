# NMI

AI-driven Android UI automation framework. Uses **accessibility tree + screenshot** for element recognition and action planning — no image-only guessing.

## How it works

NMI connects to an Android device via ADB, captures the screen and accessibility tree, then sends both to a vision-language model (VLM) to decide what action to take. The a11y tree provides precise element coordinates and semantics, while the screenshot gives visual context.

```
Screenshot + A11y Tree → VLM Planning → Action Execution → Verify → Repeat
```

## Install

```bash
npm install nmi
```

**Prerequisites:**
- Node.js >= 18
- ADB installed and in PATH
- Android device/emulator connected via ADB
- A VLM API key (default: Alibaba DashScope qwen-vl-max)

## Quick Start

```bash
# Set your API key
export ANDROID_AI_API_KEY=your-api-key

# Optional: configure model (defaults to qwen-vl-max on DashScope)
export ANDROID_AI_MODEL_NAME=qwen-vl-max
export ANDROID_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### AI-Driven (VLM decides what to do)

```typescript
import { Agent } from 'nmi';

const agent = new Agent();

// Natural language instruction — the agent figures out the steps
const result = await agent.aiAct('Open the Settings app');
console.log(result.success);      // true/false
console.log(result.cycles);       // step-by-step execution trace
console.log(result.duration);     // total time in ms

// Assert screen state
const { pass, thought } = await agent.aiAssert('The Settings page is visible');

// Query information from screen
const title = await agent.aiQuery('What is the page title?');

// Wait for a condition
await agent.aiWaitFor('A loading spinner disappears', { timeout: 10000 });

await agent.destroy();
```

### Deterministic (no LLM, direct device control)

```typescript
import { Agent } from 'nmi';

const agent = new Agent();

// Tap by coordinates
await agent.tap(540, 960);

// Tap by a11y selector — finds the element in the a11y tree and taps its center
await agent.tapElement({ resourceId: 'login_button' });
await agent.tapElement({ text: 'Submit' });
await agent.tapElement({ contentDesc: 'Navigate up' });

// Type text, swipe, navigate
await agent.input('hello world');
await agent.swipe(540, 1500, 540, 500, 300);
await agent.scroll('down');
await agent.back();
await agent.home();

// Read screen state
const a11yTree = await agent.getA11yTree();       // compressed text
const rawTree = await agent.getA11yTreeRaw();      // structured A11yNode
const screenshot = await agent.screenshot();        // base64 JPEG

// Find elements without tapping
const el = await agent.findElement({ className: 'EditText' });
const buttons = await agent.findAllElements({ className: 'Button' });

await agent.destroy();
```

### Excel Test Runner

Define test cases in an Excel file with columns: `用例名称`, `步骤名称`, `操作指令`, `预期结果`.

```typescript
import { runExcelTests } from 'nmi';

const report = await runExcelTests('./test-cases.xlsx');
console.log(`${report.summary.passed}/${report.summary.total} passed`);
```

## ActionResult

Every `aiAct()` call returns a rich result with full execution trace:

```typescript
interface ActionResult {
  success: boolean;
  thought?: string;          // final reasoning
  message?: string;          // completion message
  cycles: CycleRecord[];    // step-by-step trace
  duration: number;          // total ms
  screenshotAfter?: string;  // base64 JPEG of final state
  a11yTreeAfter?: string;    // compressed a11y tree of final state
}

interface CycleRecord {
  thought: string;           // what the agent was thinking
  action?: PlanAction;       // what it did (Tap, Input, Swipe, etc.)
  result: 'success' | 'failed' | 'skipped';
  error?: string;
  timestamp: number;
}
```

## Execution Callbacks

Monitor execution in real-time:

```typescript
const agent = new Agent({
  callbacks: {
    onAction: (action) => console.log(`Action: ${action.type}`, action.param),
    onCycleComplete: (cycle, i) => console.log(`Cycle ${i}: ${cycle.result}`),
    onError: (error, i) => console.error(`Error at cycle ${i}: ${error}`),
  },
});
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANDROID_AI_API_KEY` | — | VLM API key (required) |
| `ANDROID_AI_MODEL_NAME` | `qwen-vl-max` | Model name |
| `ANDROID_AI_BASE_URL` | DashScope endpoint | OpenAI-compatible API base URL |
| `ANDROID_SERIAL` | auto-detect | Device serial for `adb -s` |
| `ANDROID_SCREENSHOT_QUALITY` | `75` | JPEG quality (1-100) |
| `ANDROID_MAX_REPLAN_CYCLES` | `20` | Max planning iterations per task |

### AgentOptions

```typescript
const agent = new Agent({
  serial: 'emulator-5554',
  model: {
    modelName: 'qwen-vl-max',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-...',
  },
  maxReplanCycles: 15,
  screenshotQuality: 60,
  taskTimeout: 30000,
  captureEndState: true,
  actionDelays: {
    delayBeforeAction: 200,
    delayAfterAction: 300,
    delayAfterInput: 500,
    delayAfterSwipe: 500,
  },
});
```

## Architecture

```
src/
├── agent/
│   ├── agent.ts              # Main API — AI-driven + deterministic methods
│   └── task-executor.ts      # Planning loop with conversation history
├── ai/
│   ├── call-ai.ts            # OpenAI-compatible API client with retry
│   ├── conversation-history.ts # Multi-turn context management
│   ├── planning.ts           # VLM prompting (plan, assert, query)
│   └── xml-parser.ts         # Parse LLM XML responses
├── device/
│   ├── adb.ts                # ADB command wrapper
│   ├── android-device.ts     # Screenshot, a11y tree, input actions
│   ├── a11y-tree.ts          # Parse & compress UIAutomator XML
│   └── a11y-selector.ts      # Find elements by a11y attributes
├── excel/
│   ├── reader.ts             # Read test cases from Excel
│   └── runner.ts             # Execute Excel test suites
├── config.ts                 # Environment & option resolution
├── types.ts                  # All type definitions
└── index.ts                  # Public exports
```

## Development

```bash
npm run build        # Build with tsup
npm run dev          # Watch mode
npm run typecheck    # tsc --noEmit
npm test             # Run tests (vitest)
```

## License

MIT
