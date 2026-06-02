import type { ModelConfig, PlanResult } from '../types.js';
import { type ChatMessage, buildImageContent, callAI } from './call-ai.js';
import { ConversationHistory } from './conversation-history.js';
import { extractXMLTag, parsePlanningResponse } from './xml-parser.js';

export const SYSTEM_PROMPT = `你是一个 Android UI 自动化助手。
你将收到一个截图和页面的 accessibility tree，你需要根据用户指令规划下一步操作。

## 可用操作
- Tap: 点击屏幕坐标 {"x": 540, "y": 200}
- Input: 在当前焦点输入文字 {"text": "搜索内容"}（先确保目标输入框已获得焦点）
- Swipe: 滑动 {"x1": 540, "y1": 1000, "x2": 540, "y2": 400, "duration": 300}
- Back: 返回键 {}
- Home: Home键 {}
- KeyEvent: 发送按键事件 {"code": 66}（66=Enter, 67=Delete, 4=Back）
- Sleep: 等待 {"ms": 1000}

## Accessibility Tree 说明
你会收到页面的 accessibility tree，格式为:
[left,top,right,bottom] ClassName#resourceId "text" [flags]
- bounds: [left,top,right,bottom] 像素坐标
- 你可以直接使用 bounds 的中心点作为点击坐标: x = (left+right)/2, y = (top+bottom)/2
- 如果 a11y tree 中找不到目标元素，用截图视觉判断坐标

## 输出格式 (严格 XML)
<thought>分析当前页面状态和下一步计划...</thought>
<action-type>Tap</action-type>
<action-param-json>{"x": 540, "y": 200}</action-param-json>

任务完成时:
<thought>任务已完成...</thought>
<complete success="true"/>

无法完成时:
<thought>无法完成原因...</thought>
<complete success="false">具体失败原因</complete>

## 规则
- 每轮只输出一个 action
- 优先使用 accessibility tree 中的坐标（更精确）
- 看不到目标元素时先尝试滚动
- Input 操作前确保输入框已被点击获得焦点
- 不要重复执行已经成功的步骤
- 如果收到 <error-feedback>，说明上一步执行出错了，请尝试不同的操作策略`;

export async function plan(
  instruction: string,
  screenshot: string,
  a11yTree: string,
  history: ConversationHistory,
  config: ModelConfig,
  errorFeedback?: string,
): Promise<PlanResult> {
  const userContent: string[] = [];

  userContent.push(`<task>${instruction}</task>`);

  if (a11yTree) {
    userContent.push(`\n<accessibility-tree>\n${a11yTree}\n</accessibility-tree>`);
  }

  const logsStr = history.formatLogs();
  if (logsStr) {
    userContent.push(logsStr);
  }

  if (errorFeedback) {
    userContent.push(`\n<error-feedback>${errorFeedback}</error-feedback>`);
  }

  history.addUserTurn(userContent.join('\n'), screenshot);

  const messages = history.snapshot();

  let response = await callAI({ messages, config });
  try {
    const result = parsePlanningResponse(response);
    history.addAssistantResponse(response);
    return result;
  } catch {
    console.warn('[nmi] Failed to parse planning response, retrying LLM call...');
    response = await callAI({ messages, config });
    const result = parsePlanningResponse(response);
    history.addAssistantResponse(response);
    return result;
  }
}

export async function queryAI(
  question: string,
  screenshot: string,
  a11yTree: string,
  config: ModelConfig,
): Promise<string> {
  const userText = a11yTree
    ? `基于当前页面截图和 accessibility tree，回答以下问题:\n\n<accessibility-tree>\n${a11yTree}\n</accessibility-tree>\n\n问题: ${question}`
    : `基于当前页面截图，回答以下问题: ${question}`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        buildImageContent(screenshot),
      ],
    },
  ];

  return callAI({ messages, config });
}

export async function assertAI(
  assertion: string,
  screenshot: string,
  a11yTree: string,
  config: ModelConfig,
): Promise<{ pass: boolean; thought: string }> {
  const userText = a11yTree
    ? `基于当前页面截图和 accessibility tree，判断以下断言是否成立。\n\n<accessibility-tree>\n${a11yTree}\n</accessibility-tree>\n\n断言: ${assertion}\n\n请用以下格式回答:\n<thought>你的分析...</thought>\n<result>pass</result> 或 <result>fail</result>`
    : `基于当前页面截图，判断以下断言是否成立。\n\n断言: ${assertion}\n\n请用以下格式回答:\n<thought>你的分析...</thought>\n<result>pass</result> 或 <result>fail</result>`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        buildImageContent(screenshot),
      ],
    },
  ];

  const response = await callAI({ messages, config });

  return parseAssertResponse(response);
}

export function parseAssertResponse(response: string): { pass: boolean; thought: string } {
  const thought = extractXMLTag(response, 'thought') ?? response;
  const resultStr = extractXMLTag(response, 'result')?.trim().toLowerCase();
  const pass = resultStr === 'pass';

  return { pass, thought };
}
