# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

NMI is an Android UI automation framework that combines accessibility tree parsing with screenshots, sending both to a vision-language model (VLM) to plan and execute actions on a connected Android device via ADB. Default VLM is Alibaba DashScope qwen-vl-max, but any OpenAI-compatible API works.

## Build & Development Commands

```bash
npm run build        # Build with tsup (ESM, outputs to dist/)
npm run dev          # Watch mode rebuild
npm run typecheck    # tsc --noEmit
npm test             # Run all tests (vitest)
npx vitest run tests/xml-parser.test.ts   # Run a single test file
npx vitest -t "extracts content"          # Run tests matching a name pattern
```

Run examples with environment variables loaded from `.env`:
```bash
npm run example:tap       # tsx --env-file=.env examples/simple-tap.ts
npm run example -- examples/run-excel.ts  # run any example file
```

## Architecture

The system has a clear layered design — each layer only calls down:

```
Agent (public API)
  └─ TaskExecutor (planning loop)
       ├─ ConversationHistory (multi-turn context with image/tree budget)
       ├─ planning.ts (VLM prompting: plan, assert, query)
       │    ├─ call-ai.ts (OpenAI SDK client with retry)
       │    └─ xml-parser.ts (parse LLM XML responses)
       └─ AndroidDevice (device abstraction)
            ├─ ADB (raw shell/exec-out commands)
            ├─ a11y-tree.ts (parse UIAutomator XML → compressed text)
            └─ a11y-selector.ts (find elements by attribute matching)
```

### Key design decisions

- **Agent** (`src/agent/agent.ts`) is the sole public entry point. It has two API surfaces: AI-driven methods (`aiAct`, `aiAssert`, `aiQuery`, `aiWaitFor`) that use the VLM, and deterministic methods (`tap`, `tapElement`, `input`, `swipe`, etc.) that bypass the LLM entirely.

- **TaskExecutor** (`src/agent/task-executor.ts`) implements the observe-plan-act loop: each cycle captures a screenshot + a11y tree, calls the VLM for the next action, executes it, and loops until `<complete>` or max cycles. It tracks consecutive errors and supports abort signals/timeouts.

- **ConversationHistory** (`src/ai/conversation-history.ts`) manages token budget by: (1) compressing old messages when count exceeds `maxMessages`, (2) keeping only the last N images (`maxImages=2`), (3) replacing old a11y trees with placeholders (`maxA11yTrees=2`). The `snapshot()` method returns an optimized clone.

- **VLM protocol** (`src/ai/planning.ts`): The system prompt is in Chinese. The LLM responds with XML tags: `<thought>`, `<action-type>`, `<action-param-json>`, and `<complete success="true|false"/>`. The xml-parser extracts these with regex-based parsing (not a full XML parser) and handles edge cases like both action+complete present (action wins, forces another observation round).

- **A11y tree compression** (`src/device/a11y-tree.ts`): UIAutomator XML is parsed via `fast-xml-parser`, then compressed by removing invisible/empty nodes and flattening single-child layout containers. Output is a human-readable text format: `[bounds] ClassName#resourceId "text" [flags]`.

- **ADB layer** (`src/device/adb.ts`): Uses `child_process.execFile` (not `exec`) for safety. Screenshots use `exec-out screencap -p` for binary output. The UI dump goes through a temp file on the device (`/sdcard/window_dump.xml`).

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ANDROID_AI_API_KEY` | (required) | VLM API key |
| `ANDROID_AI_MODEL_NAME` | `qwen-vl-max` | Model name |
| `ANDROID_AI_BASE_URL` | DashScope endpoint | OpenAI-compatible base URL |
| `ANDROID_SERIAL` | auto-detect | Target device serial |
| `ANDROID_SCREENSHOT_QUALITY` | `75` | JPEG quality (1-100) |
| `ANDROID_MAX_REPLAN_CYCLES` | `20` | Max planning iterations |

## Testing

Tests are in `tests/` and use vitest. Tests cover the pure-logic modules (xml-parser, a11y-selector, a11y-tree, conversation-history) — they don't require a device or API key. Test files import directly from `src/` (not `dist/`).

## Excel Test Runner

The excel module reads test cases from `.xlsx` files with columns: `用例名称`/`name`, `步骤`/`step`, `操作指令`/`instruction`, `预期结果`/`expected`. Both Chinese and English column headers are supported. Each step runs `aiAct` then optionally `aiAssert` if an expected result is provided.

## Anti Fake Success

Never make the task appear successful by hiding failure.

Do not silently add fallback, mock data, hardcoded output, default success, swallowed exceptions, skipped validation, weakened assertions, or bypassed integrations.

If the real path fails, expose the failure clearly. Return an explicit error or degraded state instead of `success: true`.

Any fallback must be explicitly documented with its trigger condition, lost correctness, observability, and tests.

Tests must verify real behavior and postconditions, not merely that something is non-null or does not throw.

Before claiming completion, list any fallback/catch/mock/default/skip/hardcoded logic added. If none, say:

"No hidden fallback, mock, fake data, skipped validation, or fake-success path was added."