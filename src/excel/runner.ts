import { Agent } from '../agent/agent.js';
import type { AgentOptions, TestCase, TestReport, TestStepResult } from '../types.js';
import { readTestCases } from './reader.js';

export async function runExcelTests(
  filePath: string,
  options: AgentOptions = {},
): Promise<TestReport> {
  const cases = readTestCases(filePath);
  return runTestCases(cases, options);
}

export async function runTestCases(
  cases: TestCase[],
  options: AgentOptions = {},
): Promise<TestReport> {
  const agent = new Agent(options);
  const results: TestStepResult[] = [];

  try {
    for (const testCase of cases) {
      for (const step of testCase.steps) {
        try {
          const actionResult = await agent.aiAct(step.instruction);

          if (!actionResult.success) {
            results.push({
              testCase: testCase.name,
              step: step.stepName,
              pass: false,
              thought: actionResult.thought,
              error: actionResult.message ?? 'Action failed',
            });
            continue;
          }

          if (step.expected) {
            const assertion = await agent.aiAssert(step.expected);
            results.push({
              testCase: testCase.name,
              step: step.stepName,
              pass: assertion.pass,
              thought: assertion.thought,
            });
          } else {
            results.push({
              testCase: testCase.name,
              step: step.stepName,
              pass: true,
              thought: actionResult.thought,
            });
          }
        } catch (error) {
          results.push({
            testCase: testCase.name,
            step: step.stepName,
            pass: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } finally {
    await agent.destroy();
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
    },
  };
}
