import type { PlanAction, PlanResult } from '../types.js';

const VALID_ACTION_TYPES = new Set<PlanAction['type']>([
  'Tap', 'Input', 'Swipe', 'Back', 'Home', 'Sleep', 'KeyEvent',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAttributes(attrsText: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrsText) return attrs;

  const attrPattern = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrPattern.exec(attrsText)) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }
  return attrs;
}

function findOpeningTag(
  text: string,
  tagName: string,
  beforeIdx: number,
): { closeBracketIdx: number; attrsText: string } | undefined {
  let searchFrom = beforeIdx;
  const openTag = `<${tagName}`;

  while (searchFrom >= 0) {
    const openIdx = text.lastIndexOf(openTag, searchFrom);
    if (openIdx === -1) return undefined;

    const nextChar = text[openIdx + openTag.length];
    if (nextChar === '>' || /\s/.test(nextChar)) {
      const closeBracketIdx = text.indexOf('>', openIdx);
      if (closeBracketIdx === -1 || closeBracketIdx > beforeIdx) return undefined;
      return {
        closeBracketIdx,
        attrsText: text.slice(openIdx + openTag.length, closeBracketIdx),
      };
    }

    searchFrom = openIdx - 1;
  }

  return undefined;
}

export function extractXMLTag(text: string, tagName: string): string | undefined {
  const closeTag = `</${tagName}>`;

  const closeIdx = text.lastIndexOf(closeTag);
  if (closeIdx === -1) return undefined;

  const opening = findOpeningTag(text, tagName, closeIdx);
  if (!opening) return undefined;

  return text.slice(opening.closeBracketIdx + 1, closeIdx).trim();
}

export function extractXMLTagAttributes(text: string, tagName: string): Record<string, string> | undefined {
  const closeTag = `</${tagName}>`;
  const closeIdx = text.lastIndexOf(closeTag);
  if (closeIdx === -1) return undefined;

  const opening = findOpeningTag(text, tagName, closeIdx);
  if (!opening) return undefined;
  return parseAttributes(opening.attrsText);
}

export function extractSelfClosingTag(
  text: string,
  tagName: string,
): Record<string, string> | undefined {
  const pattern = new RegExp(`<${escapeRegex(tagName)}(?:\\s+([^>]*?))?\\s*/>`, 's');
  const match = text.match(pattern);
  if (!match) return undefined;

  return parseAttributes(match[1]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(param: Record<string, unknown>, key: string, actionType: PlanAction['type']): void {
  if (typeof param[key] !== 'number' || !Number.isFinite(param[key])) {
    throw new Error(`Invalid ${actionType} action parameter: "${key}" must be a finite number`);
  }
}

function validateActionParam(actionType: PlanAction['type'], param: Record<string, unknown>): void {
  switch (actionType) {
    case 'Tap':
      requireFiniteNumber(param, 'x', actionType);
      requireFiniteNumber(param, 'y', actionType);
      break;
    case 'Input':
      if (typeof param.text !== 'string') {
        throw new Error('Invalid Input action parameter: "text" must be a string');
      }
      break;
    case 'Swipe':
      for (const key of ['x1', 'y1', 'x2', 'y2']) {
        requireFiniteNumber(param, key, actionType);
      }
      if (param.duration !== undefined && (typeof param.duration !== 'number' || !Number.isFinite(param.duration))) {
        throw new Error('Invalid Swipe action parameter: "duration" must be a finite number');
      }
      break;
    case 'KeyEvent':
      if (
        !(
          (typeof param.code === 'number' && Number.isFinite(param.code))
          || (typeof param.code === 'string' && param.code.trim().length > 0)
        )
      ) {
        throw new Error('Invalid KeyEvent action parameter: "code" must be a number or non-empty string');
      }
      break;
    case 'Sleep':
      if (param.ms !== undefined && (typeof param.ms !== 'number' || !Number.isFinite(param.ms))) {
        throw new Error('Invalid Sleep action parameter: "ms" must be a finite number');
      }
      break;
    case 'Back':
    case 'Home':
      break;
  }
}

function parseActionParam(actionType: PlanAction['type'], actionParamJson: string | undefined): Record<string, unknown> {
  let param: Record<string, unknown> = {};
  if (actionParamJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(actionParamJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON in <action-param-json>: ${message}`);
    }

    if (!isRecord(parsed)) {
      throw new Error('<action-param-json> must parse to a JSON object');
    }
    param = parsed;
  }

  validateActionParam(actionType, param);
  return param;
}

function hasExplicitFailureText(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /\b(fail|failed|failure|cannot|can't|unable|error)\b/.test(lower)
    || /失败|无法|不能|错误|报错|未通过|不通过/.test(text);
}

function parseCompleteSuccess(
  attrs: Record<string, string> | undefined,
  completeContent: string | undefined,
): boolean {
  const successAttr = attrs?.success?.trim().toLowerCase();
  if (successAttr === 'true') return true;
  if (successAttr === 'false') return false;
  if (hasExplicitFailureText(completeContent)) return false;
  throw new Error('Missing or invalid success attribute on <complete>');
}

export function parsePlanningResponse(text: string): PlanResult {
  const thought = extractXMLTag(text, 'thought') ?? '';

  const actionType = extractXMLTag(text, 'action-type');
  const actionParamJson = extractXMLTag(text, 'action-param-json');

  const completeSelfClose = extractSelfClosingTag(text, 'complete');
  const completeAttrs = completeSelfClose ?? extractXMLTagAttributes(text, 'complete');
  const completeContent = extractXMLTag(text, 'complete');
  const hasComplete = completeSelfClose !== undefined || completeContent !== undefined;

  // When both action and complete are present, ignore complete - force another
  // observation round so the action's effect gets visually verified.
  if (actionType) {
    if (!VALID_ACTION_TYPES.has(actionType as PlanAction['type'])) {
      throw new Error(`Unknown action type from AI: "${actionType}"`);
    }

    const actionTypeValue = actionType as PlanAction['type'];
    const param = parseActionParam(actionTypeValue, actionParamJson);

    if (hasComplete) {
      console.warn('[nmi] Response included both action and <complete>; ignoring <complete>.');
    }

    return {
      thought,
      action: {
        type: actionTypeValue,
        param,
      },
      complete: false,
      success: false,
    };
  }

  if (hasComplete) {
    const success = parseCompleteSuccess(completeAttrs, completeContent);
    return {
      thought,
      complete: true,
      success,
      message: completeContent ?? completeAttrs?.message ?? undefined,
    };
  }

  throw new Error('Failed to parse action or complete tag from AI response');
}
