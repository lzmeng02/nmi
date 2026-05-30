import { Agent } from '../src/index.js';

async function main() {
  const agent = new Agent({
    // serial: 'emulator-5554',  // optional, auto-detect if only one device
  });

  try {
    // Simple tap
    const result = await agent.aiAct('打开设置应用');
    console.log('Result:', result);

    // Assert something on screen
    const assertion = await agent.aiAssert('当前页面是设置页面');
    console.log('Assertion:', assertion);

    // Query information
    const info = await agent.aiQuery('当前页面标题是什么?');
    console.log('Query result:', info);
  } finally {
    await agent.destroy();
  }
}

main().catch(console.error);
