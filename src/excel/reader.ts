import * as XLSX from 'xlsx';
import type { TestCase, TestStep } from '../types.js';

export function readTestCases(filePath: string): TestCase[] {
  const workbook = XLSX.readFile(filePath, { sheets: 0 });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  const cases: TestCase[] = [];
  let currentCase: TestCase | null = null;

  for (const row of rows) {
    const caseName = (row['用例名称'] || row['name'] || row['Name'] || '').trim();
    const stepName = (row['步骤'] || row['step'] || row['Step'] || '').trim();
    const instruction = (row['操作指令'] || row['instruction'] || row['Instruction'] || row['操作'] || '').trim();
    const expected = (row['预期结果'] || row['expected'] || row['Expected'] || '').trim();

    if (!instruction) continue;

    if (caseName) {
      currentCase = { name: caseName, steps: [] };
      cases.push(currentCase);
    }

    if (!currentCase) {
      currentCase = { name: 'Default', steps: [] };
      cases.push(currentCase);
    }

    const step: TestStep = {
      stepName: stepName || `Step ${currentCase.steps.length + 1}`,
      instruction,
      expected: expected || undefined,
    };

    currentCase.steps.push(step);
  }

  return cases;
}
