import { registerPlugin } from '@capacitor/core';
import type { OfflineDebugCollectorPlugin } from './definitions';

/**
 * RTK 插件中与离线调试相关的方法接口
 * 实现位于 android/app/src/main/java/com/mappin/app/RTKPlugin.java
 */
interface RTKDebugBridge {
  startDebugCollection(): Promise<{ success: boolean; sessionDir: string }>;
  stopDebugCollectionAndShare(): Promise<{
    success: boolean;
    obsCount: number;
    rtcmCount: number;
    duration: number;
    zipFile: string;
  }>;
  getDebugCollectionStatus(): Promise<{
    isCollecting: boolean;
    obsCount: number;
    rtcmCount: number;
    duration?: number;
  }>;
}

// 离线调试收集器通过 RTK 插件实现，避免在 Android 端注册两个 Capacitor 插件
const RTKPlugin = registerPlugin<RTKDebugBridge>('RTK');

export const OfflineDebugCollector: OfflineDebugCollectorPlugin = {
  async startCollection() {
    return await RTKPlugin.startDebugCollection();
  },

  async stopAndShare() {
    return await RTKPlugin.stopDebugCollectionAndShare();
  },

  async getStatus() {
    return await RTKPlugin.getDebugCollectionStatus();
  },
};

export * from './definitions';
