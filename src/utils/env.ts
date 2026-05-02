/**
 * 环境工具函数
 */

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const mode = import.meta.env.MODE;

/**
 * 获取错误消息（根据环境显示不同详细程度）
 */
export function getErrorMessage(
  userMessage: string,
  technicalDetails?: string
): string {
  if (isProduction) {
    return userMessage;
  }

  return technicalDetails
    ? `${userMessage}\n\n[开发环境] ${technicalDetails}`
    : userMessage;
}

/**
 * 只在开发环境执行
 */
export function devOnly(fn: () => void) {
  if (isDevelopment) {
    fn();
  }
}

/**
 * 只在生产环境执行
 */
export function prodOnly(fn: () => void) {
  if (isProduction) {
    fn();
  }
}
