import type { A11yNode, A11ySelector } from '../types.js';

function matchesSelector(node: A11yNode, selector: A11ySelector): boolean {
  if (selector.resourceId !== undefined && node.resourceId !== selector.resourceId) return false;
  if (selector.text !== undefined && node.text !== selector.text) return false;
  if (selector.contentDesc !== undefined && node.contentDesc !== selector.contentDesc) return false;
  if (selector.className !== undefined && node.className !== selector.className) return false;
  return true;
}

export function findElement(root: A11yNode, selector: A11ySelector): A11yNode | null {
  if (matchesSelector(root, selector)) return root;
  for (const child of root.children) {
    const found = findElement(child, selector);
    if (found) return found;
  }
  return null;
}

export function findAllElements(root: A11yNode, selector: A11ySelector): A11yNode[] {
  const results: A11yNode[] = [];
  if (matchesSelector(root, selector)) results.push(root);
  for (const child of root.children) {
    results.push(...findAllElements(child, selector));
  }
  return results;
}

export function getElementCenter(node: A11yNode): { x: number; y: number } {
  const [left, top, right, bottom] = node.bounds;
  return {
    x: Math.round((left + right) / 2),
    y: Math.round((top + bottom) / 2),
  };
}
