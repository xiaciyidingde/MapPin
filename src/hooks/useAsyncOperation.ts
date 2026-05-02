import { useState } from 'react';
import { message } from 'antd';
import { errorHandler } from '../services/errorHandler';

interface UseAsyncOperationOptions {
  successMessage?: string;
  errorMessage?: string;
  showLoading?: boolean;
  loadingMessage?: string;
}

/**
 * 异步操作 Hook
 * 自动处理加载状态、错误处理和成功提示
 */
export function useAsyncOperation<T extends (...args: unknown[]) => Promise<unknown>>(
  operation: T,
  options: UseAsyncOperationOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | null> => {
    setLoading(true);
    setError(null);

    const messageKey = 'async-operation';

    if (options.showLoading) {
      message.loading({
        content: options.loadingMessage || '处理中...',
        key: messageKey,
        duration: 0,
      });
    }

    try {
      const result = await operation(...args);

      if (options.successMessage) {
        if (options.showLoading) {
          // 使用相同的 key，自动替换 loading 消息
          message.success({
            content: options.successMessage,
            key: messageKey,
          });
        } else {
          errorHandler.showSuccess(options.successMessage);
        }
      } else if (options.showLoading) {
        // 如果没有成功消息，只关闭 loading
        message.destroy(messageKey);
      }

      return result as Awaited<ReturnType<T>>;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('未知错误');
      setError(error);

      const errorMsg = options.errorMessage || error.message;
      
      if (options.showLoading) {
        // 使用相同的 key，自动替换 loading 消息
        message.error({
          content: errorMsg,
          key: messageKey,
        });
      } else {
        errorHandler.showError(errorMsg);
      }

      errorHandler.logError(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setLoading(false);
  };

  return { execute, loading, error, reset };
}
