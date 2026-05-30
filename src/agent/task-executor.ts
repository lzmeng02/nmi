import type { ModelConfig } from '../types.js';
import { plan } from '../ai/planning.js';
import { AndroidDevice } from '../device/android-device.js';
import type { ActionRecord, ActionResult, PlanAction, PlanResult, Size } from '../types.js';

export interface ActionDelays {
  delayBeforeAction?: number;
  delayAfterAction?: number;
  delayAfterInput?: number;
  delayAfterSwipe?: number;
}

export interface TaskExecutorOptions {
  device: AndroidDevice;
  modelConfig: ModelConfig;
  maxReplanCycles?: number;
  maxConsecutiveErrors?: number;
  taskTimeout?: number;
  abortSignal?: AbortSignal;
  actionDelays?: ActionDelays;
}

const DEFAULT_DELAYS: Required<ActionDelays> = {
  delayBeforeAction: 200,
  delayAfterAction: 300,
  delayAfterInput: 500,
  delayAfterSwipe: 500,
};

export class TaskExecutor {
  private device: AndroidDevice;
  private config: ModelConfig;
  private maxReplanCycles: number;
  private maxConsecutiveErrors: number;
  private taskTimeout: number;
  private abortSignal?: AbortSignal;
  private delays: Required<ActionDelays>;

  constructor(options: TaskExecutorOptions) {
    this.device = options.device;
    this.config = options.modelConfig;
    this.maxReplanCycles = options.maxReplanCycles ?? 20;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 5;
    this.taskTimeout = options.taskTimeout ?? 0;
    this.abortSignal = options.abortSignal;
    this.delays = { ...DEFAULT_DELAYS, ...options.actionDelays };
  }

  private checkAbort(): void {
    if (this.abortSignal?.aborted) {
      throw new Error(`Task aborted: ${this.abortSignal.reason || 'signal aborted'}`);
    }
  }

  async runAction(instruction: string): Promise<ActionResult> {
    const history: ActionRecord[] = [];
    let errorCount = 0;
    let pendingErrorFeedback: string | undefined;
    const startTime = Date.now();

    for (let cycle = 0; cycle < this.maxReplanCycles; cycle++) {
      this.checkAbort();

      if (this.taskTimeout > 0 && Date.now() - startTime > this.taskTimeout) {
        return {
          success: false,
          message: `Task timed out after ${this.taskTimeout}ms`,
        };
      }
      const screenshot = await this.device.screenshot();
      let a11yTree = '';
      try {
        a11yTree = await this.device.getA11yTree();
      } catch {
        // a11y tree unavailable, proceed with screenshot only
      }

      let planResult: PlanResult;
      try {
        planResult = await plan(instruction, screenshot, a11yTree, history, this.config, pendingErrorFeedback);
        pendingErrorFeedback = undefined;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errorCount++;
        pendingErrorFeedback = `Planning failed: ${msg}`;
        if (errorCount >= this.maxConsecutiveErrors) {
          return {
            success: false,
            message: `Aborted: ${this.maxConsecutiveErrors} consecutive failures. Last error: ${msg}`,
          };
        }
        continue;
      }

      if (planResult.complete) {
        return {
          success: planResult.success,
          thought: planResult.thought,
          message: planResult.message,
        };
      }

      if (!planResult.action) {
        return {
          success: false,
          thought: planResult.thought,
          message: 'No action returned from planner',
        };
      }

      try {
        await this.executeAction(planResult.action);
        history.push({ action: planResult.action, result: 'success' });
        errorCount = 0;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errorCount++;
        history.push({ action: planResult.action, result: `failed: ${msg}` });
        pendingErrorFeedback = `Action ${planResult.action.type}(${JSON.stringify(planResult.action.param)}) failed: ${msg}. Try a different approach.`;

        if (errorCount >= this.maxConsecutiveErrors) {
          return {
            success: false,
            thought: planResult.thought,
            message: `Aborted: ${this.maxConsecutiveErrors} consecutive execution failures. Last error: ${msg}`,
          };
        }
      }
    }

    return {
      success: false,
      message: `Exceeded maximum replan cycles (${this.maxReplanCycles})`,
    };
  }

  private clampX(x: number, screen: Size): number {
    return Math.max(0, Math.min(Math.round(x), screen.width - 1));
  }

  private clampY(y: number, screen: Size): number {
    return Math.max(0, Math.min(Math.round(y), screen.height - 1));
  }

  private async executeAction(action: PlanAction): Promise<void> {
    const { type, param } = action;
    const screen = await this.device.getScreenSize();

    if (this.delays.delayBeforeAction > 0 && type !== 'Sleep') {
      await this.device.sleep(this.delays.delayBeforeAction);
    }

    switch (type) {
      case 'Tap':
        await this.device.tap(
          this.clampX(param.x as number, screen),
          this.clampY(param.y as number, screen),
        );
        break;

      case 'Input':
        await this.device.input(param.text as string);
        break;

      case 'Swipe':
        await this.device.swipe(
          this.clampX(param.x1 as number, screen),
          this.clampY(param.y1 as number, screen),
          this.clampX(param.x2 as number, screen),
          this.clampY(param.y2 as number, screen),
          (param.duration as number) ?? 300,
        );
        break;

      case 'Back':
        await this.device.back();
        break;

      case 'Home':
        await this.device.home();
        break;

      case 'KeyEvent':
        await this.device.keyEvent(param.code as number);
        break;

      case 'Sleep':
        await this.device.sleep((param.ms as number) ?? 1000);
        break;

      default:
        throw new Error(`Unknown action type: ${type}`);
    }

    if (type !== 'Sleep') {
      const delay = type === 'Input' ? this.delays.delayAfterInput
        : type === 'Swipe' ? this.delays.delayAfterSwipe
        : this.delays.delayAfterAction;
      if (delay > 0) {
        await this.device.sleep(delay);
      }
    }
  }
}
