/**
 * RTK 插件接口定义
 * 提供 CORS 连接、GPS 原始数据访问、RTK 解算等功能
 */

export interface RTKPlugin {
  /**
   * 连接 CORS 基站
   */
  connect(options: CORSConnectionOptions): Promise<{ success: boolean; message?: string }>;

  /**
   * 断开 CORS 连接
   */
  disconnect(): Promise<{ success: boolean }>;

  /**
   * 获取当前连接状态
   */
  getConnectionStatus(): Promise<ConnectionStatus>;

  /**
   * 获取 RTK 状态
   */
  getRTKStatus(): Promise<RTKStatusResult>;

  /**
   * 开始 RTK 定位
   */
  startRTKPositioning(options: { updateInterval: number }): Promise<{ success: boolean }>;

  /**
   * 停止 RTK 定位
   */
  stopRTKPositioning(): Promise<{ success: boolean }>;

  /**
   * 添加位置更新监听器
   */
  addListener(
    eventName: 'rtkPositionUpdate',
    listenerFunc: (data: RTKPosition) => void
  ): Promise<PluginListenerHandle>;

  /**
   * 添加 RTK 状态更新监听器
   */
  addListener(
    eventName: 'rtkStatusUpdate',
    listenerFunc: (data: RTKStatusResult) => void
  ): Promise<PluginListenerHandle>;

  /**
   * 添加星历加载状态监听器
   */
  addListener(
    eventName: 'ephemerisLoadingStatus',
    listenerFunc: (data: { loading: boolean }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * 添加星历失败状态监听器
   */
  addListener(
    eventName: 'ephemerisFailedStatus',
    listenerFunc: (data: { failed: boolean }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * 移除所有监听器
   */
  removeAllListeners(): Promise<void>;
}

/**
 * CORS 连接选项
 */
export interface CORSConnectionOptions {
  host: string;
  port: number;
  mountpoint: string;
  username: string;
  password: string;
}

/**
 * 连接状态
 */
export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  message?: string;
  connectedAt?: number;
}

/**
 * RTK 状态结果
 */
export interface RTKStatusResult {
  fixType: 'NONE' | 'SPP' | 'DGPS' | 'FLOAT' | 'FIXED' | 'SBAS' | 'PPP' | 'DR';
  satelliteCount: number;
  satellitesWithEphemeris: number;
  ephemerisReady: boolean;
  age: number;
  hdop: number;
  vdop: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * RTK 位置
 */
export interface RTKPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  fixType: 'NONE' | 'SPP' | 'DGPS' | 'FLOAT' | 'FIXED' | 'SBAS' | 'PPP' | 'DR';
  timestamp: number;
}

/**
 * 插件监听器句柄
 */
export interface PluginListenerHandle {
  remove: () => Promise<void>;
}
