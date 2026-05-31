import { describe, it, expect } from 'vitest';
import { ConversationHistory } from '../src/ai/conversation-history.js';

describe('ConversationHistory', () => {
  describe('seed', () => {
    it('sets system message', () => {
      const h = new ConversationHistory();
      h.seed('You are a bot');
      const snap = h.snapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0]).toEqual({ role: 'system', content: 'You are a bot' });
    });

    it('replaces previous state when called again', () => {
      const h = new ConversationHistory();
      h.seed('first');
      h.addAssistantResponse('response');
      h.appendLog('some log');
      h.seed('second');
      const snap = h.snapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].content).toBe('second');
      expect(h.getLogs()).toEqual([]);
    });
  });

  describe('addUserTurn', () => {
    it('adds user message with text and image', () => {
      const h = new ConversationHistory();
      h.seed('sys');
      h.addUserTurn('describe this', 'AAAA');
      const snap = h.snapshot();
      expect(snap).toHaveLength(2);
      expect(snap[1].role).toBe('user');
      const content = snap[1].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'describe this' });
      expect(content[1]).toMatchObject({ type: 'image_url' });
    });
  });

  describe('addAssistantResponse', () => {
    it('adds assistant message with string content', () => {
      const h = new ConversationHistory();
      h.seed('sys');
      h.addAssistantResponse('hello');
      const snap = h.snapshot();
      expect(snap[1]).toEqual({ role: 'assistant', content: 'hello' });
    });
  });

  describe('logs', () => {
    it('appendLog and getLogs', () => {
      const h = new ConversationHistory();
      h.appendLog('Step 1: Tap');
      h.appendLog('Step 2: Input');
      expect(h.getLogs()).toEqual(['Step 1: Tap', 'Step 2: Input']);
    });

    it('getLogs returns a copy', () => {
      const h = new ConversationHistory();
      h.appendLog('Step 1');
      const logs = h.getLogs();
      logs.push('mutated');
      expect(h.getLogs()).toEqual(['Step 1']);
    });

    it('formatLogs wraps in XML when logs exist', () => {
      const h = new ConversationHistory();
      h.appendLog('Step 1: Tap');
      h.appendLog('Step 2: Input');
      const formatted = h.formatLogs();
      expect(formatted).toContain('<previous-actions>');
      expect(formatted).toContain('Step 1: Tap');
      expect(formatted).toContain('Step 2: Input');
      expect(formatted).toContain('</previous-actions>');
    });

    it('formatLogs returns empty string when no logs', () => {
      const h = new ConversationHistory();
      expect(h.formatLogs()).toBe('');
    });
  });

  describe('reset', () => {
    it('clears messages and logs', () => {
      const h = new ConversationHistory();
      h.seed('sys');
      h.addUserTurn('text', 'img');
      h.appendLog('log');
      h.reset();
      expect(h.snapshot()).toEqual([]);
      expect(h.getLogs()).toEqual([]);
    });
  });

  describe('snapshot compression', () => {
    it('does not compress when under threshold', () => {
      const h = new ConversationHistory({ maxMessages: 10 });
      h.seed('sys');
      for (let i = 0; i < 4; i++) {
        h.addUserTurn(`msg ${i}`, 'img');
        h.addAssistantResponse(`resp ${i}`);
      }
      const snap = h.snapshot();
      // 1 system + 8 turns = 9 messages, under threshold of 10
      expect(snap).toHaveLength(9);
    });

    it('compresses when over threshold', () => {
      const h = new ConversationHistory({ maxMessages: 6, keepMessages: 4 });
      h.seed('sys');
      for (let i = 0; i < 5; i++) {
        h.addUserTurn(`msg ${i}`, 'img');
        h.addAssistantResponse(`resp ${i}`);
      }
      // 1 system + 10 turns = 11 messages → compress to system + placeholder + 4 kept
      const snap = h.snapshot();
      expect(snap).toHaveLength(6); // system + placeholder + 4 kept
      expect(snap[0].role).toBe('system');
      expect(snap[1].role).toBe('user');
      expect(String(snap[1].content)).toContain('omitted');
    });

    it('compresses without system message', () => {
      const h = new ConversationHistory({ maxMessages: 4, keepMessages: 2 });
      // Skip seed — directly add turns
      for (let i = 0; i < 5; i++) {
        h.addUserTurn(`msg ${i}`, 'img');
        h.addAssistantResponse(`resp ${i}`);
      }
      const snap = h.snapshot();
      // No system, so: placeholder + 2 kept = 3
      expect(snap).toHaveLength(3);
      expect(String(snap[0].content)).toContain('omitted');
    });
  });

  describe('snapshot image optimization', () => {
    it('keeps last N images, replaces older ones', () => {
      const h = new ConversationHistory({ maxMessages: 100, maxImages: 2 });
      h.seed('sys');
      h.addUserTurn('turn 1', 'IMG1');
      h.addAssistantResponse('r1');
      h.addUserTurn('turn 2', 'IMG2');
      h.addAssistantResponse('r2');
      h.addUserTurn('turn 3', 'IMG3');

      const snap = h.snapshot();
      // Last 2 images (turn 3, turn 2) kept; turn 1 replaced
      const turn1Content = snap[1].content as Array<Record<string, unknown>>;
      const turn1Img = turn1Content.find((p) => p.type === 'text' && String(p.text).includes('screenshot omitted'));
      expect(turn1Img).toBeDefined();

      const turn3Content = snap[5].content as Array<Record<string, unknown>>;
      const turn3Img = turn3Content.find((p) => p.type === 'image_url');
      expect(turn3Img).toBeDefined();
    });
  });

  describe('snapshot a11y tree optimization', () => {
    it('keeps last N a11y trees, replaces older ones', () => {
      const h = new ConversationHistory({ maxMessages: 100, maxA11yTrees: 1 });
      h.seed('sys');
      h.addUserTurn('text\n<accessibility-tree>\ntree1\n</accessibility-tree>', 'IMG1');
      h.addAssistantResponse('r1');
      h.addUserTurn('text\n<accessibility-tree>\ntree2\n</accessibility-tree>', 'IMG2');

      const snap = h.snapshot();
      // turn 1 tree should be replaced (only keep last 1)
      const turn1Content = snap[1].content as Array<Record<string, unknown>>;
      const turn1Text = turn1Content.find((p) => p.type === 'text') as Record<string, string>;
      expect(turn1Text.text).toContain('(omitted)');
      expect(turn1Text.text).not.toContain('tree1');

      // turn 2 tree should be kept
      const turn2Content = snap[3].content as Array<Record<string, unknown>>;
      const turn2Text = turn2Content.find((p) => p.type === 'text') as Record<string, string>;
      expect(turn2Text.text).toContain('tree2');
    });
  });

  describe('snapshot deep clone', () => {
    it('mutations to snapshot do not affect internal state', () => {
      const h = new ConversationHistory();
      h.seed('sys');
      h.addUserTurn('hello', 'img');

      const snap1 = h.snapshot();
      snap1.push({ role: 'assistant', content: 'injected' });
      snap1[0].content = 'modified';

      const snap2 = h.snapshot();
      expect(snap2).toHaveLength(2);
      expect(snap2[0].content).toBe('sys');
    });
  });
});
