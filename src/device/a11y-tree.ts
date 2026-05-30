import { XMLParser } from 'fast-xml-parser';
import type { A11yNode, Size } from '../types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
});

interface RawNode {
  '@_class'?: string;
  '@_resource-id'?: string;
  '@_text'?: string;
  '@_content-desc'?: string;
  '@_bounds'?: string;
  '@_clickable'?: string;
  '@_scrollable'?: string;
  '@_focusable'?: string;
  '@_checked'?: string;
  '@_enabled'?: string;
  node?: RawNode | RawNode[];
}

function parseBounds(boundsStr: string): [number, number, number, number] {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return [0, 0, 0, 0];
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
    Number.parseInt(match[4], 10),
  ];
}

function stripPackagePrefix(resourceId: string): string {
  const colonIndex = resourceId.indexOf(':id/');
  return colonIndex >= 0 ? resourceId.slice(colonIndex + 4) : resourceId;
}

function stripClassPrefix(className: string): string {
  const prefixes = ['android.widget.', 'android.view.', 'androidx.recyclerview.widget.'];
  for (const prefix of prefixes) {
    if (className.startsWith(prefix)) {
      return className.slice(prefix.length);
    }
  }
  const lastDot = className.lastIndexOf('.');
  return lastDot >= 0 ? className.slice(lastDot + 1) : className;
}

function convertRawNode(raw: RawNode): A11yNode {
  const children: A11yNode[] = [];
  if (raw.node) {
    const childNodes = Array.isArray(raw.node) ? raw.node : [raw.node];
    for (const child of childNodes) {
      children.push(convertRawNode(child));
    }
  }

  return {
    className: stripClassPrefix(raw['@_class'] ?? ''),
    resourceId: raw['@_resource-id'] ? stripPackagePrefix(raw['@_resource-id']) : undefined,
    text: raw['@_text'] || undefined,
    contentDesc: raw['@_content-desc'] || undefined,
    bounds: parseBounds(raw['@_bounds'] ?? ''),
    clickable: raw['@_clickable'] === 'true',
    scrollable: raw['@_scrollable'] === 'true',
    focusable: raw['@_focusable'] === 'true',
    checked: raw['@_checked'] === 'true' ? true : undefined,
    enabled: raw['@_enabled'] !== 'false',
    children,
  };
}

export function parseA11yXml(xml: string): A11yNode {
  const parsed = parser.parse(xml);
  const hierarchy = parsed.hierarchy;
  if (!hierarchy) {
    throw new Error('Invalid UIAutomator dump: no <hierarchy> root');
  }

  const rootNode = hierarchy.node;
  if (!rootNode) {
    return {
      className: 'Root',
      bounds: [0, 0, 0, 0],
      clickable: false,
      scrollable: false,
      focusable: false,
      enabled: true,
      children: [],
    };
  }

  return convertRawNode(rootNode);
}

function isVisible(node: A11yNode, screenSize: Size): boolean {
  const [left, top, right, bottom] = node.bounds;
  const area = (right - left) * (bottom - top);
  if (area <= 0) return false;
  if (right <= 0 || bottom <= 0) return false;
  if (left >= screenSize.width || top >= screenSize.height) return false;
  return true;
}

function hasContent(node: A11yNode): boolean {
  return !!(node.text || node.contentDesc || node.resourceId);
}

function isInteractive(node: A11yNode): boolean {
  return node.clickable || node.scrollable || node.focusable;
}

function shouldKeepNode(node: A11yNode, screenSize: Size): boolean {
  if (!isVisible(node, screenSize)) return false;
  if (hasContent(node) || isInteractive(node)) return true;
  return node.children.length > 0;
}

function isFlattenableContainer(node: A11yNode): boolean {
  if (hasContent(node) || isInteractive(node)) return false;
  const containerClasses = [
    'FrameLayout', 'LinearLayout', 'RelativeLayout',
    'ConstraintLayout', 'ViewGroup', 'View',
  ];
  return containerClasses.includes(node.className) && node.children.length === 1;
}

function compressNode(node: A11yNode, screenSize: Size): A11yNode | null {
  if (!shouldKeepNode(node, screenSize)) return null;

  const compressedChildren: A11yNode[] = [];
  for (const child of node.children) {
    const compressed = compressNode(child, screenSize);
    if (compressed) compressedChildren.push(compressed);
  }

  const result = { ...node, children: compressedChildren };

  if (isFlattenableContainer(result) && result.children.length === 1) {
    return result.children[0];
  }

  if (!hasContent(result) && !isInteractive(result) && result.children.length === 0) {
    return null;
  }

  return result;
}

function nodeToString(node: A11yNode, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const [left, top, right, bottom] = node.bounds;

  let line = `${prefix}[${left},${top},${right},${bottom}] ${node.className}`;

  if (node.resourceId) {
    line += `#${node.resourceId}`;
  }
  if (node.text) {
    line += ` "${node.text}"`;
  }
  if (node.contentDesc) {
    line += ` desc="${node.contentDesc}"`;
  }

  const flags: string[] = [];
  if (node.clickable) flags.push('clickable');
  if (node.scrollable) flags.push('scrollable');
  if (node.checked) flags.push('checked');
  if (!node.enabled) flags.push('disabled');

  if (flags.length > 0) {
    line += ` ${flags.join(' ')}`;
  }

  const lines = [line];
  for (const child of node.children) {
    lines.push(nodeToString(child, indent + 1));
  }

  return lines.join('\n');
}

export function compressA11yTree(root: A11yNode, screenSize: Size): string {
  const compressed = compressNode(root, screenSize);
  if (!compressed) return '';
  return nodeToString(compressed);
}
