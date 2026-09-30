// @vitest-environment node
import { expect, it } from 'vitest';
import { inspectOpenAIAccess } from './openai-doctor.mjs';

it('fails before making a request when the environment credential is absent', () => {
  let called = false;
  expect(inspectOpenAIAccess({ env: {}, execute: () => { called = true; } }).ready).toBe(false);
  expect(called).toBe(false);
});

it('keeps credentials out of argv and reports only read access', () => {
  const key = 'test-secret';
  const report = inspectOpenAIAccess({ env: { OPENAI_API_KEY: key }, execute: (command: string, args: string[], options: { input: string }) => {
    expect(command).toBe('curl');
    expect(args).not.toContain(key);
    expect(args).not.toContain('--location');
    expect(options.input).toContain('OpenAI-Beta: agents=v1');
    return { status: 0, stdout: '{"data":[]}\n200' };
  } });
  expect(report.ready).toBe(true);
  expect(report.detail).toContain('creation and inference remain unproven');
  expect(JSON.stringify(report)).not.toContain(key);
});

it('fails closed and suppresses secret-bearing errors or unexpected response bodies', () => {
  for (const response of [
    { status: 0, stdout: '{"error":"test-secret"}\n403' },
    { status: 0, stdout: 'test-secret\n200' },
    { status: 1, stdout: 'test-secret', stderr: 'test-secret' },
  ]) {
    const report = inspectOpenAIAccess({ env: { OPENAI_API_KEY: 'test-secret' }, execute: () => response });
    expect(report.ready).toBe(false);
    expect(JSON.stringify(report)).not.toContain('test-secret');
  }
});
