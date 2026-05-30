import OpenAI from 'openai';
import type { ModelConfig } from '../types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContent[];
}

export type ChatMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface CallAIOptions {
  messages: ChatMessage[];
  config: ModelConfig;
}

export async function callAI(options: CallAIOptions): Promise<string> {
  const { messages, config } = options;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: config.timeout ?? 60000,
  });

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: config.modelName,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        max_tokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI model');
      }
      return content;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`AI call failed after ${maxRetries} attempts: ${lastError?.message}`);
}

export function buildImageContent(base64Jpeg: string): ChatMessageContent {
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${base64Jpeg}`,
      detail: 'high',
    },
  };
}
