import { describe, it, expect } from 'vitest';
import { parseA11yXml, compressA11yTree } from '../src/device/a11y-tree.js';
import type { A11yNode, Size } from '../src/types.js';

const SCREEN: Size = { width: 1080, height: 1920 };

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

describe('parseA11yXml', () => {
  it('parses a simple hierarchy with one node', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <hierarchy rotation="0">
        <node class="android.widget.FrameLayout" bounds="[0,0][1080,1920]"
              clickable="false" scrollable="false" focusable="false" enabled="true" />
      </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.className).toBe('FrameLayout');
    expect(root.bounds).toEqual([0, 0, 1080, 1920]);
    expect(root.enabled).toBe(true);
  });

  it('parses nested nodes', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.FrameLayout" bounds="[0,0][1080,1920]"
            clickable="false" scrollable="false" focusable="false" enabled="true">
        <node class="android.widget.Button" text="OK" bounds="[100,100][300,200]"
              clickable="true" scrollable="false" focusable="true" enabled="true" />
      </node>
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].className).toBe('Button');
    expect(root.children[0].text).toBe('OK');
    expect(root.children[0].clickable).toBe(true);
  });

  it('strips package prefix from resource-id', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.Button" resource-id="com.example:id/login_btn"
            bounds="[0,0][100,100]" clickable="true" scrollable="false" focusable="false" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.resourceId).toBe('login_btn');
  });

  it('strips known class prefixes', () => {
    const xml = `<hierarchy rotation="0">
      <node class="androidx.recyclerview.widget.RecyclerView" bounds="[0,0][100,100]"
            clickable="false" scrollable="true" focusable="false" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.className).toBe('RecyclerView');
  });

  it('strips unknown class prefix to last segment', () => {
    const xml = `<hierarchy rotation="0">
      <node class="com.custom.widget.MyView" bounds="[0,0][100,100]"
            clickable="false" scrollable="false" focusable="false" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.className).toBe('MyView');
  });

  it('treats empty text as undefined', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.TextView" text="" bounds="[0,0][100,100]"
            clickable="false" scrollable="false" focusable="false" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.text).toBeUndefined();
  });

  it('defaults enabled to true when attribute is missing', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.View" bounds="[0,0][100,100]"
            clickable="false" scrollable="false" focusable="false" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.enabled).toBe(true);
  });

  it('sets enabled=false when explicitly "false"', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.Button" bounds="[0,0][100,100]"
            clickable="false" scrollable="false" focusable="false" enabled="false" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.enabled).toBe(false);
  });

  it('parses checked="true" as true', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.CheckBox" bounds="[0,0][100,100]" checked="true"
            clickable="true" scrollable="false" focusable="true" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.checked).toBe(true);
  });

  it('parses checked="false" as undefined', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.CheckBox" bounds="[0,0][100,100]" checked="false"
            clickable="true" scrollable="false" focusable="true" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.checked).toBeUndefined();
  });

  it('parses content-desc', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.ImageButton" content-desc="Menu" bounds="[0,0][100,100]"
            clickable="true" scrollable="false" focusable="true" enabled="true" />
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.contentDesc).toBe('Menu');
  });

  it('throws on XML without hierarchy', () => {
    expect(() => parseA11yXml('<root><node /></root>')).toThrow('no <hierarchy> root');
  });

  it('returns Root placeholder when hierarchy has no child node', () => {
    const xml = '<hierarchy rotation="0"></hierarchy>';
    const root = parseA11yXml(xml);
    expect(root.className).toBe('Root');
    expect(root.bounds).toEqual([0, 0, 0, 0]);
    expect(root.children).toEqual([]);
  });

  it('handles multiple sibling nodes', () => {
    const xml = `<hierarchy rotation="0">
      <node class="android.widget.FrameLayout" bounds="[0,0][1080,1920]"
            clickable="false" scrollable="false" focusable="false" enabled="true">
        <node class="android.widget.Button" text="A" bounds="[0,0][100,50]"
              clickable="true" scrollable="false" focusable="false" enabled="true" />
        <node class="android.widget.Button" text="B" bounds="[0,50][100,100]"
              clickable="true" scrollable="false" focusable="false" enabled="true" />
      </node>
    </hierarchy>`;
    const root = parseA11yXml(xml);
    expect(root.children).toHaveLength(2);
    expect(root.children[0].text).toBe('A');
    expect(root.children[1].text).toBe('B');
  });
});

describe('compressA11yTree', () => {
  it('keeps interactive nodes', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({ text: 'Click me', bounds: [10, 10, 200, 60], clickable: true }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('Click me');
    expect(result).toContain('clickable');
  });

  it('keeps nodes with text content', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({ text: 'Hello', bounds: [10, 10, 200, 60] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('"Hello"');
  });

  it('keeps nodes with resourceId', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({ resourceId: 'my_view', bounds: [10, 10, 200, 60] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('#my_view');
  });

  it('prunes off-screen nodes', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      text: 'root',
      children: [
        makeNode({ text: 'offscreen', bounds: [1100, 0, 1200, 100] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).not.toContain('offscreen');
  });

  it('prunes zero-area nodes', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      text: 'root',
      children: [
        makeNode({ text: 'zeroarea', bounds: [50, 50, 50, 50] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).not.toContain('zeroarea');
  });

  it('flattens single-child FrameLayout container', () => {
    const root = makeNode({
      className: 'FrameLayout',
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({
          className: 'FrameLayout',
          bounds: [0, 0, 1080, 1920],
          children: [
            makeNode({ text: 'Deep child', bounds: [10, 10, 200, 60] }),
          ],
        }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('Deep child');
    const frameLayoutCount = (result.match(/FrameLayout/g) || []).length;
    expect(frameLayoutCount).toBeLessThanOrEqual(1);
  });

  it('does not flatten container with 2 children', () => {
    const root = makeNode({
      className: 'LinearLayout',
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({ text: 'A', bounds: [10, 10, 200, 60] }),
        makeNode({ text: 'B', bounds: [10, 70, 200, 120] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('LinearLayout');
    expect(result).toContain('"A"');
    expect(result).toContain('"B"');
  });

  it('does not flatten interactive container', () => {
    const root = makeNode({
      className: 'FrameLayout',
      bounds: [0, 0, 1080, 1920],
      clickable: true,
      children: [
        makeNode({ text: 'child', bounds: [10, 10, 200, 60] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('FrameLayout');
    expect(result).toContain('clickable');
  });

  it('returns empty string when entire tree is pruned', () => {
    const root = makeNode({
      className: 'FrameLayout',
      bounds: [0, 0, 1080, 1920],
      children: [
        makeNode({ bounds: [2000, 2000, 2100, 2100] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toBe('');
  });

  it('formats bounds in output', () => {
    const root = makeNode({
      text: 'Hello',
      bounds: [10, 20, 300, 400],
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('[10,20,300,400]');
  });

  it('shows contentDesc in output', () => {
    const root = makeNode({
      contentDesc: 'Navigate up',
      bounds: [10, 10, 100, 100],
      clickable: true,
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('desc="Navigate up"');
  });

  it('shows checked flag', () => {
    const root = makeNode({
      text: 'Toggle',
      bounds: [10, 10, 100, 100],
      clickable: true,
      checked: true,
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('checked');
  });

  it('shows disabled flag', () => {
    const root = makeNode({
      text: 'Disabled btn',
      bounds: [10, 10, 100, 100],
      enabled: false,
    });
    const result = compressA11yTree(root, SCREEN);
    expect(result).toContain('disabled');
  });

  it('indents child nodes', () => {
    const root = makeNode({
      bounds: [0, 0, 1080, 1920],
      resourceId: 'container',
      children: [
        makeNode({ text: 'child', bounds: [10, 10, 200, 60] }),
      ],
    });
    const result = compressA11yTree(root, SCREEN);
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toMatch(/^\s{2}/);
  });
});
