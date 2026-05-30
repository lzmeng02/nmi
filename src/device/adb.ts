import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ADBOptions {
  serial?: string;
  adbPath?: string;
}

export class ADB {
  private serial?: string;
  private adbPath: string;

  constructor(options: ADBOptions = {}) {
    this.serial = options.serial;
    this.adbPath = options.adbPath ?? 'adb';
  }

  private buildArgs(args: string[]): string[] {
    if (this.serial) {
      return ['-s', this.serial, ...args];
    }
    return args;
  }

  async shell(command: string): Promise<string> {
    const args = this.buildArgs(['shell', command]);
    const { stdout } = await execFileAsync(this.adbPath, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    return stdout;
  }

  async execOut(command: string): Promise<Buffer> {
    const args = this.buildArgs(['exec-out', command]);
    const { stdout } = await execFileAsync(this.adbPath, args, {
      maxBuffer: 20 * 1024 * 1024,
      encoding: 'buffer',
      timeout: 30000,
    });
    return stdout;
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    const output = await this.shell('wm size');
    const match = output.match(/(\d+)x(\d+)/);
    if (!match) {
      throw new Error(`Failed to parse screen size from: ${output}`);
    }
    return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
  }

  async screencap(): Promise<Buffer> {
    return this.execOut('screencap -p');
  }

  async tap(x: number, y: number): Promise<void> {
    await this.shell(`input tap ${Math.round(x)} ${Math.round(y)}`);
  }

  async longPress(x: number, y: number, duration = 1000): Promise<void> {
    await this.shell(`input swipe ${Math.round(x)} ${Math.round(y)} ${Math.round(x)} ${Math.round(y)} ${duration}`);
  }

  async input(text: string): Promise<void> {
    const escaped = text.replace(/([\\'"$`!#&|;()\s])/g, '\\$1');
    await this.shell(`input text "${escaped}"`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration = 300): Promise<void> {
    await this.shell(
      `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`,
    );
  }

  async keyEvent(code: number | string): Promise<void> {
    await this.shell(`input keyevent ${code}`);
  }

  async dumpUI(): Promise<string> {
    await this.shell('uiautomator dump /sdcard/window_dump.xml');
    const xml = await this.shell('cat /sdcard/window_dump.xml');
    return xml;
  }

  async getDevices(): Promise<string[]> {
    const { stdout } = await execFileAsync(this.adbPath, ['devices'], { timeout: 10000 });
    return stdout
      .split('\n')
      .slice(1)
      .filter((line) => line.includes('\tdevice'))
      .map((line) => line.split('\t')[0]);
  }

  async isConnected(): Promise<boolean> {
    try {
      const devices = await this.getDevices();
      if (this.serial) {
        return devices.includes(this.serial);
      }
      return devices.length > 0;
    } catch {
      return false;
    }
  }
}
