import { runExcelTests } from '../src/index.js';

async function main() {
  const report = await runExcelTests('./test-cases.xlsx', {
    // serial: 'emulator-5554',
    // model: { modelName: 'qwen-vl-max' },
  });

  console.log('\n=== Test Report ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log('');

  for (const result of report.results) {
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${result.testCase} > ${result.step}`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
  }
}

main().catch(console.error);
