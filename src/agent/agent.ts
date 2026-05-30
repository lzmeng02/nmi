import { getMaxReplanCycles, getModelConfig, getScreenshotQuality, getDeviceSerial } from '../config.js';
import { assertAI, queryAI } from '../ai/planning.js';
import { AndroidDevice } from '../device/android-device.js';
import type { ActionResult, AgentOptions, ModelConfig } from '../types.js';
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
    });
  }

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
    const screenshot = await this.device.screenshot();
    let a11yTree = '';
    try {
      a11yTree = await this.device.getA11yTree();
    } catch {
      // proceed without a11y tree
    }
    return assertAI(assertion, screenshot, a11yTree, this.config);
  }

  async aiQuery<T = string>(question: string): Promise<T> {
    const screenshot = await this.device.screenshot();
    let a11yTree = '';
    try {
      a11yTree = await this.device.getA11yTree();
    } catch {
      // proceed without a11y tree
    }
    const result = await queryAI(question, screenshot, a11yTree, this.config);
    return result as T;
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

  async screenshot(): Promise<string> {
    return this.device.screenshot();
  }

  async destroy(): Promise<void> {
    await this.device.destroy();
  }
}
