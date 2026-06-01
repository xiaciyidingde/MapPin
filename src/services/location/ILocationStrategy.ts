/**
 * 定位策略接口
 * 定义所有定位策略必须实现的方法
 */

import type {
  Position,
  PositionCallback,
  WatchHandle,
  LocationCapabilities,
  LocationMode,
} from '../../types/location';

export interface ILocationStrategy {
  /**
   * 策略类型
   */
  readonly type: LocationMode;

  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 获取当前位置（单次）
   */
  getCurrentPosition(): Promise<Position>;

  /**
   * 监听位置更新（持续）
   */
  watchPosition(callback: PositionCallback): WatchHandle;

  /**
   * 获取定位能力
   */
  getCapabilities(): LocationCapabilities;

  /**
   * 检查策略是否可用
   */
  isAvailable(): Promise<boolean>;

  /**
   * 启动策略
   */
  start(): Promise<void>;

  /**
   * 停止策略
   */
  stop(): void;

  /**
   * 获取策略状态
   */
  getStatus(): {
    active: boolean;
    lastUpdate?: number;
    error?: string;
  };
}
