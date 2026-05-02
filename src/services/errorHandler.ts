import { message, notification } from 'antd';
import { isDevelopment } from '../utils/env';

export enum ErrorType {
  FILE_PARSE = 'FILE_PARSE',
  FILE_SIZE = 'FILE_SIZE',
  FILE_TYPE = 'FILE_TYPE',
  DATABASE = 'DATABASE',
  COORDINATE = 'COORDINATE',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  originalError?: Error;
}

class ErrorHandler {
  private errorMessages: Record<ErrorType, string> = {
    [ErrorType.FILE_PARSE]: '文件解析失败',
    [ErrorType.FILE_SIZE]: '文件大小超出限制',
    [ErrorType.FILE_TYPE]: '不支持的文件类型',
    [ErrorType.DATABASE]: '数据库操作失败',
    [ErrorType.COORDINATE]: '坐标转换失败',
    [ErrorType.NETWORK]: '网络请求失败',
    [ErrorType.UNKNOWN]: '未知错误',
  };

  showError(error: AppError | string, duration = 3) {
    const errorMessage =
      typeof error === 'string' ? error : error.message || this.errorMessages[error.type];
    message.error(errorMessage, duration);
  }

  showDetailedError(error: AppError) {
    const title = this.errorMessages[error.type] || '操作失败';
    notification.error({
      message: title,
      description: error.message,
      duration: isDevelopment ? 10 : 5,
      placement: 'topRight',
    });
  }

  showSuccess(msg: string, duration = 2) {
    message.success(msg, duration);
  }

  showWarning(msg: string, duration = 3) {
    message.warning(msg, duration);
  }

  showInfo(msg: string, duration = 2) {
    message.info(msg, duration);
  }

  handleFileError(error: Error, fileName: string): AppError {
    if (error.message.includes('size')) {
      return {
        type: ErrorType.FILE_SIZE,
        message: `文件 ${fileName} 超过 50MB 限制`,
        details: '请选择小于 50MB 的文件',
        originalError: error,
      };
    }

    if (error.message.includes('type') || error.message.includes('format')) {
      return {
        type: ErrorType.FILE_TYPE,
        message: `文件 ${fileName} 格式不正确`,
        details: '请确保文件是 .dat 格式的测量数据文件',
        originalError: error,
      };
    }

    return {
      type: ErrorType.FILE_PARSE,
      message: `解析文件 ${fileName} 失败`,
      details: '文件内容格式不正确，请检查文件是否为有效的测量数据',
      originalError: error,
    };
  }

  handleDatabaseError(error: Error, operation: string): AppError {
    return {
      type: ErrorType.DATABASE,
      message: `${operation}失败`,
      details: '数据库操作出错，请稍后重试',
      originalError: error,
    };
  }

  handleCoordinateError(error: Error): AppError {
    return {
      type: ErrorType.COORDINATE,
      message: '坐标转换失败',
      details: '请检查坐标系统和投影配置是否正确',
      originalError: error,
    };
  }

  logError(error: AppError | Error) {
    if (isDevelopment) {
      console.group('🔴 错误详情');
      console.error('错误对象:', error);
      if ('originalError' in error && error.originalError) {
        console.error('原始错误:', error.originalError);
        console.error('堆栈跟踪:', error.originalError.stack);
      }
      console.groupEnd();
    }
  }
}

export const errorHandler = new ErrorHandler();
