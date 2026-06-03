/**
 * GPS 定位策略
 * 使用浏览器 Geolocation API 进行普通 GPS 定位
 */

import type {
  Position,
  PositionCallback,
  WatchHandle,
  LocationCapabilities,
} from '../../types/location';
import type { ILocationStrategy } from './ILocationStrategy';
import { appConfig } from '../../config/appConfig';

export class GPSStrategy implements ILocationStrategy {
  readonly type = 'gps' as const;
  readonly name = 'GPS 定位';

  private watchId: number | null = null;
  private lastPosition: Position | null = null;
  private lastError: string | undefined;
  private callbacks: Set<PositionCallback> = new Set();

  /**
   * 获取当前位置
   */
  async getCurrentPosition(): Promise<Position> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持 Geolocation API'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: appConfig.location.timeout,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        (geoPosition) => {
          const position = this.convertPosition(geoPosition);
          this.lastPosition = position;
          this.lastError = undefined;
          resolve(position);
        },
        (error) => {
          this.lastError = this.getErrorMessage(error);
          reject(new Error(this.lastError));
        },
        options
      );
    });
  }

  /**
   * 监听位置更新
   */
  watchPosition(callback: PositionCallback): WatchHandle {
    this.callbacks.add(callback);

    // 如果还没有开始监听，启动监听
    if (this.watchId === null && navigator.geolocation) {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: appConfig.location.timeout + 5000,
        maximumAge: 0,
      };

      this.watchId = navigator.geolocation.watchPosition(
        (geoPosition) => {
          const position = this.convertPosition(geoPosition);
          this.lastPosition = position;
          this.lastError = undefined;

          // 通知所有回调
          this.callbacks.forEach((cb) => cb(position));
        },
        (error) => {
          this.lastError = this.getErrorMessage(error);
          console.warn('GPS 位置更新失败:', this.lastError);
        },
        options
      );
    }

    // 返回移除句柄
    return {
      remove: () => {
        this.callbacks.delete(callback);

        // 如果没有回调了，停止监听
        if (this.callbacks.size === 0 && this.watchId !== null) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
        }
      },
    };
  }

  /**
   * 获取定位能力
   */
  getCapabilities(): LocationCapabilities {
    return {
      hasGPS: !!navigator.geolocation,
      hasRTK: false,
      hasBluetooth: false,
      hasCompass: true, // 大部分设备支持
      maxAccuracy: 5, // GPS 典型精度 5-50m
    };
  }

  /**
   * 检查是否可用
   */
  async isAvailable(): Promise<boolean> {
    if (!navigator.geolocation) {
      return false;
    }

    // 尝试获取一次位置来检查权限
    try {
      await this.getCurrentPosition();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 启动策略
   */
  async start(): Promise<void> {
    // GPS 策略不需要特殊启动逻辑
    // 在 watchPosition 时自动启动
  }

  /**
   * 停止策略
   */
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.callbacks.clear();
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      active: this.watchId !== null,
      lastUpdate: this.lastPosition?.timestamp,
      error: this.lastError,
    };
  }

  /**
   * 转换浏览器位置对象为内部格式
   */
  private convertPosition(geoPosition: GeolocationPosition): Position {
    return {
      lat: geoPosition.coords.latitude,
      lng: geoPosition.coords.longitude,
      altitude: geoPosition.coords.altitude ?? undefined,
      accuracy: geoPosition.coords.accuracy,
      verticalAccuracy: geoPosition.coords.altitudeAccuracy ?? undefined,
      heading: geoPosition.coords.heading ?? undefined,
      speed: geoPosition.coords.speed ?? undefined,
      timestamp: geoPosition.timestamp,
    };
  }

  /**
   * 获取错误信息
   */
  private getErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return '定位权限被拒绝';
      case error.POSITION_UNAVAILABLE:
        return '位置信息不可用';
      case error.TIMEOUT:
        return '定位超时';
      default:
        return '未知错误';
    }
  }
}
