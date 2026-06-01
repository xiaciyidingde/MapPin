/**
 * 定位相关类型定义
 */

import type { LatLng } from './index';

/**
 * 定位模式
 */
export type LocationMode = 'gps' | 'cors' | 'bluetooth' | 'simulate';

/**
 * RTK 固定解类型（对应 RTKLIB SOLQ_*）
 */
export type FixType = 'NONE' | 'SPP' | 'DGPS' | 'FLOAT' | 'FIXED' | 'SBAS' | 'PPP' | 'DR';

/**
 * 定位质量等级
 */
export type QualityGrade = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * 位置信息（扩展）
 */
export interface Position extends LatLng {
  altitude?: number;
  accuracy: number;
  verticalAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

/**
 * RTK 位置信息
 */
export interface RTKPosition extends Position {
  fixType: FixType;
  satelliteCount?: number;
  age?: number; // 差分龄期（秒）
  hdop?: number; // 水平精度因子
  vdop?: number; // 垂直精度因子
}

/**
 * 位置回调函数
 */
export type PositionCallback = (position: Position) => void;

/**
 * 监听句柄
 */
export interface WatchHandle {
  remove: () => void;
}

/**
 * 定位能力
 */
export interface LocationCapabilities {
  hasGPS: boolean;
  hasRTK: boolean;
  hasBluetooth: boolean;
  hasCompass: boolean;
  maxAccuracy: number; // 最高精度（米）
}

/**
 * CORS 配置
 */
export interface CORSConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  mountpoint: string;
  username: string;
  password: string;
  enabled?: boolean;
}

/**
 * NTRIP 状态
 */
export interface NTRIPStatus {
  connected: boolean;
  mountpoint: string;
  signalStrength: number; // 0-100
  latency: number; // 毫秒
  dataRate: number; // 字节/秒
}

/**
 * RTK 状态
 */
export interface RTKStatus {
  fixType: FixType;
  satelliteCount: number;
  satellitesWithEphemeris?: number; // 有星历的卫星数量
  ephemerisReady?: boolean; // 星历是否就绪
  age: number; // 差分龄期
  hdop: number;
  vdop: number;
  quality: QualityGrade;
}

/**
 * 卫星信息
 */
export interface SatelliteInfo {
  id: number;
  system: 'GPS' | 'GLONASS' | 'Galileo' | 'BeiDou';
  elevation: number; // 仰角（度）
  azimuth: number; // 方位角（度）
  snr: number; // 信噪比（dB）
  used: boolean; // 是否用于定位
}

/**
 * 定位精度要求
 */
export interface AccuracyRequirement {
  horizontal: number; // 水平精度要求（米）
  vertical?: number; // 垂直精度要求（米）
  timeout?: number; // 超时时间（毫秒）
}

/**
 * 轨迹点
 */
export interface TrackPoint extends Position {
  id: string;
  trackId: string;
}

/**
 * 轨迹
 */
export interface Track {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  points: TrackPoint[];
  distance?: number; // 总距离（米）
  duration?: number; // 持续时间（毫秒）
}
