import { describe, it, expect } from 'vitest';
import { extractXMLTag, extractSelfClosingTag, parsePlanningResponse } from '../src/ai/xml-parser.js';

describe('extractXMLTag', () => {
  it('extracts content from a simple tag', () => {
    expect(extractXMLTag('<thought>hello world</thought>', 'thought')).toBe('hello world');
  });

  it('extracts content from a tag with attributes', () => {
    expect(extractXMLTag('<thought lang="zh">分析中</thought>', 'thought')).toBe('分析中');
  });

  it('trims whitespace from content', () => {
    expect(extractXMLTag('<thought>  spaced  </thought>', 'thought')).toBe('spaced');
  });

  it('returns undefined when open tag is missing', () => {
    expect(extractXMLTag('no tags here</thought>', 'thought')).toBeUndefined();
  });

  it('returns undefined when close tag is missing', () => {
    expect(extractXMLTag('<thought>unclosed', 'thought')).toBeUndefined();
  });

  it('returns undefined for completely unrelated text', () => {
    expect(extractXMLTag('just plain text', 'thought')).toBeUndefined();
  });

  it('takes the last occurrence when multiple exist', () => {
    const text = '<thought>first</thought> middle <thought>second</thought>';
    expect(extractXMLTag(text, 'thought')).toBe('second');
  });

  it('handles multiline content', () => {
    const text = '<thought>\nline1\nline2\n</thought>';
    expect(extractXMLTag(text, 'thought')).toBe('line1\nline2');
  });

  it('handles hyphenated tag names', () => {
    expect(extractXMLTag('<action-type>Tap</action-type>', 'action-type')).toBe('Tap');
  });
});

describe('extractSelfClosingTag', () => {
  it('extracts attributes from a self-closing tag', () => {
    const result = extractSelfClosingTag('<complete success="true"/>', 'complete');
    expect(result).toEqual({ success: 'true' });
  });

  it('extracts multiple attributes', () => {
    const result = extractSelfClosingTag('<complete success="false" message="timeout"/>', 'complete');
    expect(result).toEqual({ success: 'false', message: 'timeout' });
  });

  it('returns undefined when tag is not found', () => {
    expect(extractSelfClosingTag('no tags', 'complete')).toBeUndefined();
  });

  it('returns undefined for content tags (not self-closing)', () => {
    expect(extractSelfClosingTag('<complete>content</complete>', 'complete')).toBeUndefined();
  });

  it('handles spaces before />', () => {
    const result = extractSelfClosingTag('<complete success="true" />', 'complete');
    expect(result).toEqual({ success: 'true' });
  });
});

describe('parsePlanningResponse', () => {
  it('parses an action response', () => {
    const text = `
      <thought>I need to tap the button</thought>
      <action-type>Tap</action-type>
      <action-param-json>{"x": 540, "y": 200}</action-param-json>
    `;
    const result = parsePlanningResponse(text);
    expect(result.thought).toBe('I need to tap the button');
    expect(result.action).toEqual({ type: 'Tap', param: { x: 540, y: 200 } });
    expect(result.complete).toBe(false);
  });

  it('parses an Input action', () => {
    const text = `
      <thought>Typing search text</thought>
      <action-type>Input</action-type>
      <action-param-json>{"text": "hello"}</action-param-json>
    `;
    const result = parsePlanningResponse(text);
    expect(result.action).toEqual({ type: 'Input', param: { text: 'hello' } });
  });

  it('falls back to empty param on invalid JSON', () => {
    const text = `
      <thought>tap</thought>
      <action-type>Tap</action-type>
      <action-param-json>{broken json}</action-param-json>
    `;
    const result = parsePlanningResponse(text);
    expect(result.action!.param).toEqual({});
  });

  it('handles missing action-param-json', () => {
    const text = `
      <thought>go back</thought>
      <action-type>Back</action-type>
    `;
    const result = parsePlanningResponse(text);
    expect(result.action).toEqual({ type: 'Back', param: {} });
  });

  it('parses self-closing complete with success=true', () => {
    const text = `
      <thought>Task done</thought>
      <complete success="true"/>
    `;
    const result = parsePlanningResponse(text);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    expect(result.thought).toBe('Task done');
  });

  it('parses self-closing complete with success=false', () => {
    const text = `
      <thought>Cannot do it</thought>
      <complete success="false"/>
    `;
    const result = parsePlanningResponse(text);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(false);
  });

  it('parses content complete with failure message', () => {
    const text = `
      <thought>Stuck</thought>
      <complete>Task failed because element not found</complete>
    `;
    const result = parsePlanningResponse(text);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Task failed because element not found');
  });

  it('parses content complete without "fail" as success', () => {
    const text = `
      <thought>All good</thought>
      <complete>Task completed successfully</complete>
    `;
    const result = parsePlanningResponse(text);
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Task completed successfully');
  });

  it('ignores complete when action is also present', () => {
    const text = `
      <thought>Tapping and done</thought>
      <action-type>Tap</action-type>
      <action-param-json>{"x": 100, "y": 200}</action-param-json>
      <complete success="true"/>
    `;
    const result = parsePlanningResponse(text);
    expect(result.action).toBeDefined();
    expect(result.complete).toBe(false);
  });

  it('throws when neither action nor complete is found', () => {
    expect(() => parsePlanningResponse('<thought>confused</thought>')).toThrow(
      'Failed to parse action or complete tag',
    );
  });

  it('defaults thought to empty string when missing', () => {
    const text = '<action-type>Home</action-type>';
    const result = parsePlanningResponse(text);
    expect(result.thought).toBe('');
  });

  it('throws on completely empty input', () => {
    expect(() => parsePlanningResponse('')).toThrow();
  });
});
