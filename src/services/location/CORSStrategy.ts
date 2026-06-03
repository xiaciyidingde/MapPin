/**
 * CORS RTK 定位策略
 * 使用 CORS 基站进行高精度 RTK 定位
 * 
 * 注意：此策略需要 Capacitor 原生插件支持
 * 在 Web 环境下不可用
 */

import type {
  Position,
  RTKPosition,
  PositionCallback,
  WatchHandle,
  LocationCapabilities,
  CORSConfig,
} from '../../types/location';
import type { ILocationStrategy } from './ILocationStrategy';

export class CORSStrategy implements ILocationStrategy {
  readonly type = 'cors' as const;
  readonly name = 'CORS RTK 定位';

  private config: CORSConfig | null = null;
  private callbacks: Set<PositionCallback> = new Set();
  private lastPosition: RTKPosition | null = null;
  private lastError: string | undefined;
  private isRunning = false;

  constructor(config?: CORSConfig) {
    this.config = config ?? null;
  }

  /**
   * 设置 CORS 配置
   */
  setConfig(config: CORSConfig): void {
    this.config = config;
  }

  /**
   * 获取当前位置
   */
  async getCurrentPosition(): Promise<Position> {
    // TODO: 实现 CORS RTK 定位
    // 需要 Capacitor 插件支持
    throw new Error('CORS RTK 定位需要 Android 原生插件支持，Web 环境不可用');
  }

  /**
   * 监听位置更新
   */
  watchPosition(callback: PositionCallback): WatchHandle {
    this.callbacks.add(callback);

    // TODO: 启动 RTK 定位监听
    // 需要 Capacitor 插件支持

    return {
      remove: () => {
        this.callbacks.delete(callback);
        if (this.callbacks.size === 0) {
          this.stop();
        }
      },
    };
  }

  /**
   * 获取定位能力
   */
  getCapabilities(): LocationCapabilities {
    return {
      hasGPS: true,
      hasRTK: true,
      hasBluetooth: false,
      hasCompass: true,
      maxAccuracy: 0.02, // RTK 固定解精度 1-5cm
    };
  }

  /**
   * 检查是否可用
   */
  async isAvailable(): Promise<boolean> {
    // TODO: 检查 Capacitor 插件是否可用
    // 检查是否在 Android 平台
    return false; // Web 环境不可用
  }

  /**
   * 启动策略
   */
  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('未配置 CORS 连接信息');
    }

    // TODO: 连接 CORS 基站
    // 需要 Capacitor 插件支持
    this.isRunning = true;
  }

  /**
   * 停止策略
   */
  stop(): void {
    // TODO: 断开 CORS 连接
    this.isRunning = false;
    this.callbacks.clear();
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      active: this.isRunning,
      lastUpdate: this.lastPosition?.timestamp,
      error: this.lastError,
    };
  }

  /**
   * 获取 RTK 状态
   */
  async getRTKStatus() {
    // TODO: 获取 RTK 详细状态
    // 需要 Capacitor 插件支持
    return {
      fixType: 'NONE' as const,
      satelliteCount: 0,
      age: 0,
      hdop: 0,
      vdop: 0,
      quality: 'poor' as const,
    };
  }
}
