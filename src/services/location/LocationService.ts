/**
 * 定位服务（门面模式）
 * 统一管理多种定位策略，提供简单的 API
 */

import type {
  Position,
  PositionCallback,
  WatchHandle,
  LocationMode,
  LocationCapabilities,
  AccuracyRequirement,
} from '../../types/location';
import type { ILocationStrategy } from './ILocationStrategy';
import { GPSStrategy } from './GPSStrategy';
import { CORSStrategy } from './CORSStrategy';

export class LocationService {
  private strategies: Map<LocationMode, ILocationStrategy> = new Map();
  private currentStrategy: ILocationStrategy;
  private currentMode: LocationMode = 'gps';

  constructor() {
    // 注册可用策略
    this.registerStrategy(new GPSStrategy());
    this.registerStrategy(new CORSStrategy());

    // 默认使用 GPS 策略
    this.currentStrategy = this.strategies.get('gps')!;
  }

  /**
   * 注册定位策略
   */
  private registerStrategy(strategy: ILocationStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  /**
   * 设置定位模式
   */
  async setMode(mode: LocationMode): Promise<void> {
    const strategy = this.strategies.get(mode);
    if (!strategy) {
      throw new Error(`不支持的定位模式: ${mode}`);
    }

    // 检查策略是否可用
    const available = await strategy.isAvailable();
    if (!available) {
      throw new Error(`定位模式 ${mode} 不可用`);
    }

    // 停止当前策略
    if (this.currentStrategy) {
      this.currentStrategy.stop();
    }

    // 切换到新策略
    this.currentStrategy = strategy;
    this.currentMode = mode;

    // 启动新策略
    await strategy.start();
  }

  /**
   * 获取当前定位模式
   */
  getMode(): LocationMode {
    return this.currentMode;
  }

  /**
   * 获取当前位置
   */
  async getCurrentPosition(): Promise<Position> {
    return this.currentStrategy.getCurrentPosition();
  }

  /**
   * 监听位置更新
   */
  watchPosition(callback: PositionCallback): WatchHandle {
    return this.currentStrategy.watchPosition(callback);
  }

  /**
   * 获取定位能力
   */
  getCapabilities(): LocationCapabilities {
    return this.currentStrategy.getCapabilities();
  }

  /**
   * 获取所有可用的定位模式
   */
  async getAvailableModes(): Promise<LocationMode[]> {
    const modes: LocationMode[] = [];

    for (const [mode, strategy] of this.strategies) {
      const available = await strategy.isAvailable();
      if (available) {
        modes.push(mode);
      }
    }

    return modes;
  }

  /**
   * 根据精度要求自动选择最佳策略
   */
  async selectBestStrategy(requirement: AccuracyRequirement): Promise<LocationMode> {
    // 按精度从高到低排序
    const priorityOrder: LocationMode[] = ['cors', 'bluetooth', 'gps', 'simulate'];

    for (const mode of priorityOrder) {
      const strategy = this.strategies.get(mode);
      if (!strategy) continue;

      const available = await strategy.isAvailable();
      if (!available) continue;

      const capabilities = strategy.getCapabilities();
      if (capabilities.maxAccuracy <= requirement.horizontal) {
        return mode;
      }
    }

    // 如果没有满足要求的，返回 GPS
    return 'gps';
  }

  /**
   * 获取当前策略状态
   */
  getStatus() {
    return {
      mode: this.currentMode,
      ...this.currentStrategy.getStatus(),
    };
  }

  /**
   * 停止所有定位
   */
  stopAll(): void {
    this.strategies.forEach((strategy) => strategy.stop());
  }
}

// 导出单例
export const locationService = new LocationService();
