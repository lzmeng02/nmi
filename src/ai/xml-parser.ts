import type { PlanAction, PlanResult } from '../types.js';

export function extractXMLTag(text: string, tagName: string): string | undefined {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  const closeIdx = text.lastIndexOf(closeTag);
  if (closeIdx === -1) return undefined;

  const searchArea = text.slice(0, closeIdx);
  const openIdx = searchArea.lastIndexOf(openTag);
  if (openIdx === -1) return undefined;

  const afterOpen = text.slice(openIdx);
  const gtIdx = afterOpen.indexOf('>');
  if (gtIdx === -1) return undefined;

  const contentStart = openIdx + gtIdx + 1;
  return text.slice(contentStart, closeIdx).trim();
}

export function extractSelfClosingTag(
  text: string,
  tagName: string,
): Record<string, string> | undefined {
  const pattern = new RegExp(`<${tagName}\\s+([^>]*?)\\s*/>`, 's');
  const match = text.match(pattern);
  if (!match) return undefined;

  const attrs: Record<string, string> = {};
  const attrPattern = /(\w+)\s*=\s*"([^"]*)"/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrPattern.exec(match[1])) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }
  return attrs;
}

export function parsePlanningResponse(text: string): PlanResult {
  const thought = extractXMLTag(text, 'thought') ?? '';

  const actionType = extractXMLTag(text, 'action-type');
  const actionParamJson = extractXMLTag(text, 'action-param-json');

  const completeSelfClose = extractSelfClosingTag(text, 'complete');
  const completeContent = extractXMLTag(text, 'complete');
  const hasComplete = completeSelfClose !== undefined || completeContent !== undefined;

  // When both action and complete are present, ignore complete — force another
  // observation round so the action's effect gets visually verified.
  if (actionType) {
    let param: Record<string, unknown> = {};
    if (actionParamJson) {
      try {
        param = JSON.parse(actionParamJson);
      } catch {
        param = {};
      }
    }

    if (hasComplete) {
      console.warn('[nmi] Response included both action and <complete>; ignoring <complete>.');
    }

    return {
      thought,
      action: {
        type: actionType as PlanAction['type'],
        param,
      },
      complete: false,
      success: false,
    };
  }

  if (hasComplete) {
    const success = completeSelfClose
      ? completeSelfClose.success === 'true'
      : !completeContent?.toLowerCase().includes('fail');
    return {
      thought,
      complete: true,
      success,
      message: completeContent ?? completeSelfClose?.message ?? undefined,
    };
  }

  throw new Error('Failed to parse action or complete tag from AI response');
}
