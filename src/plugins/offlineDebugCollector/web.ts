import { WebPlugin } from '@capacitor/core';
import type { OfflineDebugCollectorPlugin } from './definitions';

export class OfflineDebugCollectorWeb extends WebPlugin implements OfflineDebugCollectorPlugin {
  async startCollection(): Promise<{ success: boolean; sessionDir: string }> {
    console.log('离线调试收集功能仅在 Android 平台可用');
    return { success: false, sessionDir: '' };
  }

  async stopAndShare(): Promise<{
    success: boolean;
    obsCount: number;
    rtcmCount: number;
    duration: number;
    zipFile: string;
  }> {
    console.log('离线调试收集功能仅在 Android 平台可用');
    return { success: false, obsCount: 0, rtcmCount: 0, duration: 0, zipFile: '' };
  }

  async getStatus(): Promise<{
    isCollecting: boolean;
    obsCount: number;
    rtcmCount: number;
    duration?: number;
  }> {
    return { isCollecting: false, obsCount: 0, rtcmCount: 0 };
  }
}
