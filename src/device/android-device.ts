import sharp from 'sharp';
import type { Size } from '../types.js';
import { ADB } from './adb.js';
import { compressA11yTree, parseA11yXml } from './a11y-tree.js';

export interface AndroidDeviceOptions {
  serial?: string;
  screenshotQuality?: number;
}

export class AndroidDevice {
  private adb: ADB;
  private screenSize: Size | null = null;
  private screenshotQuality: number;

  constructor(options: AndroidDeviceOptions = {}) {
    this.adb = new ADB({ serial: options.serial });
    this.screenshotQuality = options.screenshotQuality ?? 75;
  }

  async getScreenSize(): Promise<Size> {
    if (!this.screenSize) {
      this.screenSize = await this.adb.getScreenSize();
    }
    return this.screenSize;
  }

  async screenshot(): Promise<string> {
    const pngBuffer = await this.adb.screencap();
    const jpegBuffer = await sharp(pngBuffer)
      .jpeg({ quality: this.screenshotQuality })
      .toBuffer();
    return jpegBuffer.toString('base64');
  }

  async getA11yTree(): Promise<string> {
    const xml = await this.adb.dumpUI();
    const screenSize = await this.getScreenSize();
    const root = parseA11yXml(xml);
    return compressA11yTree(root, screenSize);
  }

  async dumpUI(): Promise<string> {
    return this.adb.dumpUI();
  }

  async tap(x: number, y: number): Promise<void> {
    await this.adb.tap(x, y);
  }

  async longPress(x: number, y: number, duration?: number): Promise<void> {
    await this.adb.longPress(x, y, duration);
  }

  async input(text: string): Promise<void> {
    await this.adb.input(text);
  }

  async clearInput(length = 50): Promise<void> {
    const delKeys = Array(length).fill('67').join(' ');
    await this.adb.shell(`input keyevent ${delKeys}`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    await this.adb.swipe(x1, y1, x2, y2, duration);
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const size = await this.getScreenSize();
    const cx = size.width / 2;
    const cy = size.height / 2;
    const distance = Math.min(size.width, size.height) * 0.3;

    switch (direction) {
      case 'up':
        await this.swipe(cx, cy + distance, cx, cy - distance, 300);
        break;
      case 'down':
        await this.swipe(cx, cy - distance, cx, cy + distance, 300);
        break;
      case 'left':
        await this.swipe(cx + distance, cy, cx - distance, cy, 300);
        break;
      case 'right':
        await this.swipe(cx - distance, cy, cx + distance, cy, 300);
        break;
    }
  }

  async back(): Promise<void> {
    await this.adb.keyEvent(4);
  }

  async home(): Promise<void> {
    await this.adb.keyEvent(3);
  }

  async keyEvent(code: number | string): Promise<void> {
    await this.adb.keyEvent(code);
  }

  async launchApp(packageName: string): Promise<void> {
    await this.adb.shell(
      `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
    );
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async destroy(): Promise<void> {
    this.screenSize = null;
  }
}
