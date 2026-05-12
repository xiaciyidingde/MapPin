import { App } from 'antd';
import { isValidFileName, sanitizeFileName } from '../utils/sanitize';

/**
 * 文件名验证 Hook
 * 统一处理文件名的验证和清理逻辑
 */
export function useFileNameValidation() {
  const { message } = App.useApp();
  
  /**
   * 验证并清理文件名
   * @param fileName 原始文件名
   * @returns 清理后的文件名，如果验证失败返回 null
   */
  const validateFileName = (fileName: string): string | null => {
    const trimmed = fileName.trim();
    
    if (!trimmed) {
      message.error('文件名不能为空');
      return null;
    }
    
    let final = trimmed;
    if (!isValidFileName(final)) {
      final = sanitizeFileName(final);
      message.warning(`文件名包含非法字符，已自动清理为：${final}`);
    }
    
    return final;
  };

  return { validateFileName };
}
