import { describe, it, expect } from 'vitest';
import { findElement, findAllElements, getElementCenter } from '../src/device/a11y-selector.js';
import type { A11yNode } from '../src/types.js';

function makeNode(overrides: Partial<A11yNode> = {}): A11yNode {
  return {
    className: 'View',
    bounds: [0, 0, 100, 100] as [number, number, number, number],
    clickable: false,
    scrollable: false,
    focusable: false,
    enabled: true,
    children: [],
    ...overrides,
  };
}

const tree: A11yNode = makeNode({
  className: 'FrameLayout',
  children: [
    makeNode({
      className: 'Button',
      resourceId: 'login_btn',
      text: 'Login',
      bounds: [10, 10, 200, 60],
      clickable: true,
    }),
    makeNode({
      className: 'EditText',
      resourceId: 'username',
      contentDesc: 'Username field',
      bounds: [10, 70, 200, 120],
      focusable: true,
      children: [
        makeNode({
          className: 'TextView',
          text: 'Hint text',
          bounds: [15, 75, 195, 115],
        }),
      ],
    }),
    makeNode({
      className: 'Button',
      resourceId: 'signup_btn',
      text: 'Sign Up',
      bounds: [10, 130, 200, 180],
      clickable: true,
    }),
  ],
});

describe('findElement', () => {
  it('finds element by resourceId', () => {
    const node = findElement(tree, { resourceId: 'login_btn' });
    expect(node).not.toBeNull();
    expect(node!.text).toBe('Login');
  });

  it('finds element by text', () => {
    const node = findElement(tree, { text: 'Sign Up' });
    expect(node).not.toBeNull();
    expect(node!.resourceId).toBe('signup_btn');
  });

  it('finds element by contentDesc', () => {
    const node = findElement(tree, { contentDesc: 'Username field' });
    expect(node).not.toBeNull();
    expect(node!.resourceId).toBe('username');
  });

  it('finds element by className', () => {
    const node = findElement(tree, { className: 'EditText' });
    expect(node).not.toBeNull();
    expect(node!.resourceId).toBe('username');
  });

  it('matches on root node', () => {
    const node = findElement(tree, { className: 'FrameLayout' });
    expect(node).toBe(tree);
  });

  it('finds nested child (depth-first)', () => {
    const node = findElement(tree, { text: 'Hint text' });
    expect(node).not.toBeNull();
    expect(node!.className).toBe('TextView');
  });

  it('returns null when no match', () => {
    expect(findElement(tree, { resourceId: 'nonexistent' })).toBeNull();
  });

  it('matches with multiple selector fields (AND logic)', () => {
    const node = findElement(tree, { className: 'Button', text: 'Login' });
    expect(node).not.toBeNull();
    expect(node!.resourceId).toBe('login_btn');
  });

  it('fails multi-field match when one field differs', () => {
    expect(findElement(tree, { className: 'Button', text: 'Hint text' })).toBeNull();
  });

  it('empty selector matches root (first node)', () => {
    const node = findElement(tree, {});
    expect(node).toBe(tree);
  });
});

describe('findAllElements', () => {
  it('returns all matching elements', () => {
    const buttons = findAllElements(tree, { className: 'Button' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Login');
    expect(buttons[1].text).toBe('Sign Up');
  });

  it('returns empty array when no match', () => {
    expect(findAllElements(tree, { text: 'nonexistent' })).toEqual([]);
  });

  it('includes root in results when it matches', () => {
    const all = findAllElements(tree, { className: 'FrameLayout' });
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(tree);
  });

  it('empty selector returns all nodes', () => {
    const all = findAllElements(tree, {});
    expect(all.length).toBeGreaterThan(1);
  });
});

describe('getElementCenter', () => {
  it('computes center of normal bounds', () => {
    const node = makeNode({ bounds: [0, 0, 200, 100] });
    expect(getElementCenter(node)).toEqual({ x: 100, y: 50 });
  });

  it('rounds to nearest integer', () => {
    const node = makeNode({ bounds: [0, 0, 3, 5] });
    expect(getElementCenter(node)).toEqual({ x: 2, y: 3 });
  });

  it('handles zero-size bounds', () => {
    const node = makeNode({ bounds: [50, 50, 50, 50] });
    expect(getElementCenter(node)).toEqual({ x: 50, y: 50 });
  });

  it('handles offset bounds', () => {
    const node = makeNode({ bounds: [100, 200, 300, 400] });
    expect(getElementCenter(node)).toEqual({ x: 200, y: 300 });
  });
});
