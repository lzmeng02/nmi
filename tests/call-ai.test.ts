import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { isRetryable } from '../src/ai/call-ai.js';

describe('isRetryable', () => {
  it('retries connection errors', () => {
    expect(isRetryable(new OpenAI.APIConnectionError({ message: 'network down' }))).toBe(true);
  });

  it('retries connection timeout errors', () => {
    expect(isRetryable(new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }))).toBe(true);
  });

  it('does not retry user abort errors', () => {
    expect(isRetryable(new OpenAI.APIUserAbortError({ message: 'aborted' }))).toBe(false);
  });

  it('retries rate limits and server errors', () => {
    const headers = new Headers();

    expect(isRetryable(OpenAI.APIError.generate(429, {}, 'rate limited', headers))).toBe(true);
    expect(isRetryable(OpenAI.APIError.generate(500, {}, 'server error', headers))).toBe(true);
  });

  it('does not retry client request errors', () => {
    const headers = new Headers();

    expect(isRetryable(OpenAI.APIError.generate(400, {}, 'bad request', headers))).toBe(false);
    expect(isRetryable(OpenAI.APIError.generate(401, {}, 'bad auth', headers))).toBe(false);
  });
});
