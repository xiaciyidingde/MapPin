import { registerPlugin } from '@capacitor/core';

export interface LogCollectorPlugin {
  /**
   * 打开日志文件
   * 日志文件在程序启动时创建，包含所有运行日志
   */
  openLogFile(): Promise<{ 
    success: boolean;
    message?: string;
  }>;
}

const LogCollector = registerPlugin<LogCollectorPlugin>('LogCollector', {
  web: () => import('./logCollector.web').then((m) => new m.LogCollectorWeb()),
});

export default LogCollector;
