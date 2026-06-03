export interface OfflineDebugCollectorPlugin {
  /**
   * 开始收集离线调试数据
   */
  startCollection(): Promise<{ success: boolean; sessionDir: string }>;

  /**
   * 停止收集并分享数据包
   */
  stopAndShare(): Promise<{
    success: boolean;
    obsCount: number;
    rtcmCount: number;
    duration: number;
    zipFile: string;
  }>;

  /**
   * 获取收集状态
   */
  getStatus(): Promise<{
    isCollecting: boolean;
    obsCount: number;
    rtcmCount: number;
    duration?: number;
  }>;
}
