import type { ChatMessage, ChatMessageContent } from './call-ai.js';
import { buildImageContent } from './call-ai.js';

export interface ConversationHistoryOptions {
  maxMessages?: number;
  keepMessages?: number;
  maxImages?: number;
  maxA11yTrees?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const A11Y_TREE_OPEN = '<accessibility-tree>';
const A11Y_TREE_CLOSE = '</accessibility-tree>';
const A11Y_TREE_PLACEHOLDER = '<accessibility-tree>(omitted)</accessibility-tree>';
const A11Y_TREE_REGEX = new RegExp(
  `${escapeRegex(A11Y_TREE_OPEN)}[\\s\\S]*?${escapeRegex(A11Y_TREE_CLOSE)}`,
  'g',
);

export class ConversationHistory {
  private messages: ChatMessage[] = [];
  private logs: string[] = [];
  private maxMessages: number;
  private keepMessages: number;
  private maxImages: number;
  private maxA11yTrees: number;

  constructor(options: ConversationHistoryOptions = {}) {
    this.maxMessages = options.maxMessages ?? 30;
    this.keepMessages = options.keepMessages ?? 12;
    this.maxImages = options.maxImages ?? 2;
    this.maxA11yTrees = options.maxA11yTrees ?? 2;
  }

  seed(systemPrompt: string): void {
    this.messages = [{ role: 'system', content: systemPrompt }];
    this.logs = [];
  }

  addUserTurn(text: string, screenshot: string): void {
    this.messages.push({
      role: 'user',
      content: [
        { type: 'text', text },
        buildImageContent(screenshot),
      ],
    });
  }

  addAssistantResponse(response: string): void {
    this.messages.push({ role: 'assistant', content: response });
  }

  appendLog(log: string): void {
    this.logs.push(log);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  formatLogs(): string {
    if (this.logs.length === 0) return '';
    return `\n<previous-actions>\n${this.logs.join('\n')}\n</previous-actions>`;
  }

  snapshot(): ChatMessage[] {
    this.compress();
    const cloned = structuredClone(this.messages);
    this.optimizeImages(cloned);
    this.optimizeA11yTrees(cloned);
    return cloned;
  }

  reset(): void {
    this.messages = [];
    this.logs = [];
  }

  private compress(): void {
    if (this.messages.length <= this.maxMessages) return;

    const systemMsg = this.messages[0]?.role === 'system' ? this.messages[0] : null;
    const omitted = this.messages.length - (systemMsg ? 1 : 0) - this.keepMessages;
    if (omitted <= 0) return;

    const kept = this.messages.slice(-this.keepMessages);
    const placeholder: ChatMessage = {
      role: 'user',
      content: `(${omitted} earlier conversation messages have been omitted)`,
    };

    this.messages = systemMsg
      ? [systemMsg, placeholder, ...kept]
      : [placeholder, ...kept];
  }

  private optimizeImages(messages: ChatMessage[]): void {
    let imageCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!Array.isArray(msg.content)) continue;

      for (let j = msg.content.length - 1; j >= 0; j--) {
        const part = msg.content[j] as ChatMessageContent;
        if (part.type === 'image_url') {
          imageCount++;
          if (imageCount > this.maxImages) {
            msg.content[j] = { type: 'text', text: '(screenshot omitted)' };
          }
        }
      }
    }
  }

  private optimizeA11yTrees(messages: ChatMessage[]): void {
    let treeCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!Array.isArray(msg.content)) continue;

      for (const part of msg.content) {
        if (part.type !== 'text') continue;
        if (!part.text.includes(A11Y_TREE_OPEN)) continue;

        treeCount++;
        if (treeCount > this.maxA11yTrees) {
          part.text = part.text.replace(A11Y_TREE_REGEX, A11Y_TREE_PLACEHOLDER);
        }
      }
    }
  }
}
