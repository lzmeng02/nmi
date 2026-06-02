import { getMaxReplanCycles, getModelConfig, getScreenshotQuality, getDeviceSerial } from '../config.js';
import { assertAI, queryAI } from '../ai/planning.js';
import { AndroidDevice } from '../device/android-device.js';
import { parseA11yXml } from '../device/a11y-tree.js';
import { findElement, findAllElements, getElementCenter } from '../device/a11y-selector.js';
import type { ActionResult, AgentOptions, A11yNode, A11ySelector, ModelConfig, Size } from '../types.js';
import { TaskExecutor } from './task-executor.js';

export class Agent {
  private device: AndroidDevice;
  private config: ModelConfig;
  private executor: TaskExecutor;

  constructor(options: AgentOptions = {}) {
    this.device = new AndroidDevice({
      serial: getDeviceSerial(options.serial),
      screenshotQuality: getScreenshotQuality(options.screenshotQuality),
    });

    this.config = getModelConfig(options.model);

    this.executor = new TaskExecutor({
      device: this.device,
      modelConfig: this.config,
      maxReplanCycles: getMaxReplanCycles(options.maxReplanCycles),
      taskTimeout: options.taskTimeout,
      abortSignal: options.abortSignal,
      actionDelays: options.actionDelays,
      captureEndState: options.captureEndState,
      callbacks: options.callbacks,
    });
  }

  // --- AI-driven methods ---

  async aiAct(instruction: string): Promise<ActionResult> {
    return this.executor.runAction(instruction);
  }

  async aiTap(description: string): Promise<ActionResult> {
    return this.executor.runAction(`点击: ${description}`);
  }

  async aiInput(target: string, text: string): Promise<ActionResult> {
    return this.executor.runAction(`在"${target}"中输入"${text}"`);
  }

  async aiAssert(assertion: string): Promise<{ pass: boolean; thought: string }> {
    const [screenshot, a11yTree] = await this.captureState();
    return assertAI(assertion, screenshot, a11yTree, this.config);
  }

  async aiQuery(question: string): Promise<string> {
    const [screenshot, a11yTree] = await this.captureState();
    return queryAI(question, screenshot, a11yTree, this.config);
  }

  async aiWaitFor(
    condition: string,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<void> {
    const timeout = options.timeout ?? 30000;
    const interval = options.interval ?? 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const { pass } = await this.aiAssert(condition);
      if (pass) return;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition: "${condition}" (${timeout}ms)`);
  }

  private async captureState(): Promise<[string, string]> {
    const [screenshot, a11yTree] = await Promise.all([
      this.device.screenshot(),
      this.device.getA11yTree().catch(() => ''),
    ]);
    return [screenshot, a11yTree];
  }

  // --- Direct device access (no LLM) ---

  async screenshot(): Promise<string> {
    return this.device.screenshot();
  }

  async getA11yTree(): Promise<string> {
    return this.device.getA11yTree();
  }

  async getA11yTreeRaw(): Promise<A11yNode> {
    const xml = await this.device.dumpUI();
    return parseA11yXml(xml);
  }

  async getScreenSize(): Promise<Size> {
    return this.device.getScreenSize();
  }

  // --- Deterministic actions (no LLM) ---

  async tap(x: number, y: number): Promise<void> {
    await this.device.tap(x, y);
  }

  async tapElement(selector: A11ySelector): Promise<void> {
    const root = await this.getA11yTreeRaw();
    const node = findElement(root, selector);
    if (!node) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }
    const center = getElementCenter(node);
    await this.device.tap(center.x, center.y);
  }

  async findElement(selector: A11ySelector): Promise<A11yNode | null> {
    const root = await this.getA11yTreeRaw();
    return findElement(root, selector);
  }

  async findAllElements(selector: A11ySelector): Promise<A11yNode[]> {
    const root = await this.getA11yTreeRaw();
    return findAllElements(root, selector);
  }

  async input(text: string): Promise<void> {
    await this.device.input(text);
  }

  async clearInput(length?: number): Promise<void> {
    await this.device.clearInput(length);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    await this.device.swipe(x1, y1, x2, y2, duration);
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    await this.device.scroll(direction);
  }

  async back(): Promise<void> {
    await this.device.back();
  }

  async home(): Promise<void> {
    await this.device.home();
  }

  async keyEvent(code: number | string): Promise<void> {
    await this.device.keyEvent(code);
  }

  async launchApp(packageName: string): Promise<void> {
    await this.device.launchApp(packageName);
  }

  async destroy(): Promise<void> {
    await this.device.destroy();
  }
}
