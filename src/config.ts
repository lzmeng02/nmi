import type { ModelConfig } from './types.js';

function env(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? '';
}

export function getModelConfig(overrides?: Partial<ModelConfig>): ModelConfig {
  return {
    modelName: overrides?.modelName ?? env('ANDROID_AI_MODEL_NAME', 'qwen-vl-max'),
    baseURL: overrides?.baseURL ?? env('ANDROID_AI_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    apiKey: overrides?.apiKey ?? env('ANDROID_AI_API_KEY'),
    maxTokens: overrides?.maxTokens ?? 4096,
    temperature: overrides?.temperature ?? 0,
    timeout: overrides?.timeout ?? 60000,
  };
}

export function getDeviceSerial(override?: string): string | undefined {
  return override ?? (env('ANDROID_SERIAL') || undefined);
}

export function getScreenshotQuality(override?: number): number {
  if (override !== undefined) return override;
  const envVal = env('ANDROID_SCREENSHOT_QUALITY');
  return envVal ? Number.parseInt(envVal, 10) : 75;
}

export function getMaxReplanCycles(override?: number): number {
  if (override !== undefined) return override;
  const envVal = env('ANDROID_MAX_REPLAN_CYCLES');
  return envVal ? Number.parseInt(envVal, 10) : 20;
}
