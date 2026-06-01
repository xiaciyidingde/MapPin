/**
 * RTK 插件 Web 实现（占位）
 * Web 环境不支持 RTK 功能
 */

import { WebPlugin } from '@capacitor/core';
import type {
  RTKPlugin,
  CORSConnectionOptions,
  ConnectionStatus,
  RTKStatusResult,
} from './definitions';

export class RTKWeb extends WebPlugin implements RTKPlugin {
  async connect(options: CORSConnectionOptions): Promise<{ success: boolean; message?: string }> {
    console.log('RTK connect called with:', options);
    throw this.unavailable('RTK 功能仅在移动端可用');
  }

  async disconnect(): Promise<{ success: boolean }> {
    throw this.unavailable('RTK 功能仅在移动端可用');
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    throw this.unavailable('RTK 功能仅在移动端可用');
  }

  async getRTKStatus(): Promise<RTKStatusResult> {
    throw this.unavailable('RTK 功能仅在移动端可用');
  }

  async startRTKPositioning(options: { updateInterval: number }): Promise<{ success: boolean }> {
    console.log('RTK startRTKPositioning called with:', options);
    throw this.unavailable('RTK 功能仅在移动端可用');
  }

  async stopRTKPositioning(): Promise<{ success: boolean }> {
    throw this.unavailable('RTK 功能仅在移动端可用');
  }
}
