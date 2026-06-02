import { describe, expect, it } from 'vitest';
import { parseAssertResponse } from '../src/ai/planning.js';

describe('parseAssertResponse', () => {
  it('passes only with an explicit pass result', () => {
    const result = parseAssertResponse(`
      <thought>The button is visible</thought>
      <result>pass</result>
    `);

    expect(result).toEqual({
      pass: true,
      thought: 'The button is visible',
    });
  });

  it('fails with an explicit fail result', () => {
    const result = parseAssertResponse(`
      <thought>The button is missing</thought>
      <result>fail</result>
    `);

    expect(result.pass).toBe(false);
    expect(result.thought).toBe('The button is missing');
  });

  it('does not pass ambiguous responses without a result tag', () => {
    const result = parseAssertResponse('<thought>Looks okay, but no strict result.</thought>');

    expect(result.pass).toBe(false);
  });

  it('does not pass Chinese failure text without a result tag', () => {
    const result = parseAssertResponse('断言失败：页面上没有目标元素');

    expect(result.pass).toBe(false);
  });
});
