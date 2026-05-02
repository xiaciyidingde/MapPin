/**
 * 日志工具
 * 开发环境：输出到 console
 * 生产环境：静默（由 Vite 构建时移除）
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * 调试信息
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * 一般信息
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * 警告信息
   */
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * 错误信息（生产环境也会输出，用于排查问题）
   */
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // 生产环境只输出简要信息，避免泄露敏感数据
      console.error('[ERROR]', args[0]);
    }
  },

  /**
   * 性能测量开始
   */
  timeStart: (label: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  /**
   * 性能测量结束
   */
  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },
};
