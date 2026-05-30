export interface ModelConfig {
  modelName: string;
  baseURL: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface AgentOptions {
  serial?: string;
  model?: Partial<ModelConfig>;
  cache?: { id: string; strategy: 'read-write' | 'read-only' | 'off' };
  maxReplanCycles?: number;
  screenshotQuality?: number;
  taskTimeout?: number;
  abortSignal?: AbortSignal;
  actionDelays?: {
    delayBeforeAction?: number;
    delayAfterAction?: number;
    delayAfterInput?: number;
    delayAfterSwipe?: number;
  };
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface A11yNode {
  className: string;
  resourceId?: string;
  text?: string;
  contentDesc?: string;
  bounds: [number, number, number, number];
  clickable: boolean;
  scrollable: boolean;
  focusable: boolean;
  checked?: boolean;
  enabled: boolean;
  children: A11yNode[];
}

export interface PlanAction {
  type: 'Tap' | 'Input' | 'Swipe' | 'Back' | 'Home' | 'Sleep' | 'KeyEvent';
  param: Record<string, unknown>;
}

export interface PlanResult {
  thought: string;
  action?: PlanAction;
  complete: boolean;
  success: boolean;
  message?: string;
}

export interface ActionRecord {
  action: PlanAction;
  result: string;
}

export interface ActionResult {
  success: boolean;
  thought?: string;
  message?: string;
}

export interface TestStep {
  stepName: string;
  instruction: string;
  expected?: string;
}

export interface TestCase {
  name: string;
  steps: TestStep[];
}

export interface TestStepResult {
  testCase: string;
  step: string;
  pass: boolean;
  thought?: string;
  error?: string;
}

export interface TestReport {
  results: TestStepResult[];
  summary: { total: number; passed: number; failed: number };
}
