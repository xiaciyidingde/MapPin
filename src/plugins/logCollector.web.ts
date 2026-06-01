import { WebPlugin } from '@capacitor/core';
import type { LogCollectorPlugin } from './logCollector';

export class LogCollectorWeb extends WebPlugin implements LogCollectorPlugin {
  async openLogFile(): Promise<{ success: boolean; message?: string }> {
    console.warn('LogCollector.openLogFile() is not available on web platform');
    return { 
      success: false,
      message: '日志功能仅在 Android 应用中可用'
    };
  }
}
