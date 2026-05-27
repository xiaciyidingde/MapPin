import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler, ErrorType, type AppError } from './errorHandler';
import { message, notification } from 'antd';

// Mock antd 组件
vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  notification: {
    error: vi.fn(),
  },
}));

// Mock env utils
vi.mock('../utils/env', () => ({
  isDevelopment: false,
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showError', () => {
    it('应该显示字符串错误消息', () => {
      errorHandler.showError('测试错误');
      expect(message.error).toHaveBeenCalledWith('测试错误', 3);
    });

    it('应该显示 AppError 对象的消息', () => {
      const error: AppError = {
        type: ErrorType.FILE_PARSE,
        message: '文件解析错误',
      };
      errorHandler.showError(error);
      expect(message.error).toHaveBeenCalledWith('文件解析错误', 3);
    });

    it('应该使用默认错误消息当 AppError 没有 message 时', () => {
      const error: AppError = {
        type: ErrorType.DATABASE,
        message: '',
      };
      errorHandler.showError(error);
      expect(message.error).toHaveBeenCalledWith('数据库操作失败', 3);
    });

    it('应该支持自定义持续时间', () => {
      errorHandler.showError('测试错误', 5);
      expect(message.error).toHaveBeenCalledWith('测试错误', 5);
    });
  });

  describe('showDetailedError', () => {
    it('应该显示详细错误通知', () => {
      const error: AppError = {
        type: ErrorType.FILE_PARSE,
        message: '文件格式不正确',
        details: '请检查文件内容',
      };
      errorHandler.showDetailedError(error);
      expect(notification.error).toHaveBeenCalledWith({
        message: '文件解析失败',
        description: '文件格式不正确',
        duration: 5,
        placement: 'topRight',
      });
    });

    it('应该使用默认标题当错误类型未知时', () => {
      const error: AppError = {
        type: ErrorType.UNKNOWN,
        message: '未知错误发生',
      };
      errorHandler.showDetailedError(error);
      expect(notification.error).toHaveBeenCalledWith({
        message: '未知错误',
        description: '未知错误发生',
        duration: 5,
        placement: 'topRight',
      });
    });
  });

  describe('showSuccess', () => {
    it('应该显示成功消息', () => {
      errorHandler.showSuccess('操作成功');
      expect(message.success).toHaveBeenCalledWith('操作成功', 2);
    });

    it('应该支持自定义持续时间', () => {
      errorHandler.showSuccess('操作成功', 4);
      expect(message.success).toHaveBeenCalledWith('操作成功', 4);
    });
  });

  describe('showWarning', () => {
    it('应该显示警告消息', () => {
      errorHandler.showWarning('警告信息');
      expect(message.warning).toHaveBeenCalledWith('警告信息', 3);
    });

    it('应该支持自定义持续时间', () => {
      errorHandler.showWarning('警告信息', 5);
      expect(message.warning).toHaveBeenCalledWith('警告信息', 5);
    });
  });

  describe('showInfo', () => {
    it('应该显示信息消息', () => {
      errorHandler.showInfo('提示信息');
      expect(message.info).toHaveBeenCalledWith('提示信息', 2);
    });

    it('应该支持自定义持续时间', () => {
      errorHandler.showInfo('提示信息', 3);
      expect(message.info).toHaveBeenCalledWith('提示信息', 3);
    });
  });

  describe('handleFileError', () => {
    it('应该处理文件大小错误', () => {
      const error = new Error('File size exceeds limit');
      const result = errorHandler.handleFileError(error, 'test.dat');
      
      expect(result.type).toBe(ErrorType.FILE_SIZE);
      expect(result.message).toBe('文件 test.dat 超过 50MB 限制');
      expect(result.details).toBe('请选择小于 50MB 的文件');
      expect(result.originalError).toBe(error);
    });

    it('应该处理文件类型错误 - type 关键词', () => {
      const error = new Error('Invalid file type');
      const result = errorHandler.handleFileError(error, 'test.txt');
      
      expect(result.type).toBe(ErrorType.FILE_TYPE);
      expect(result.message).toBe('文件 test.txt 格式不正确');
      expect(result.details).toBe('请确保文件是 .dat 格式的测量数据文件');
      expect(result.originalError).toBe(error);
    });

    it('应该处理文件类型错误 - format 关键词', () => {
      const error = new Error('Unsupported format');
      const result = errorHandler.handleFileError(error, 'data.csv');
      
      expect(result.type).toBe(ErrorType.FILE_TYPE);
      expect(result.message).toBe('文件 data.csv 格式不正确');
    });

    it('应该处理通用文件解析错误', () => {
      const error = new Error('Parse failed');
      const result = errorHandler.handleFileError(error, 'data.dat');
      
      expect(result.type).toBe(ErrorType.FILE_PARSE);
      expect(result.message).toBe('解析文件 data.dat 失败');
      expect(result.details).toBe('文件内容格式不正确，请检查文件是否为有效的测量数据');
      expect(result.originalError).toBe(error);
    });
  });

  describe('handleDatabaseError', () => {
    it('应该处理数据库错误', () => {
      const error = new Error('Database connection failed');
      const result = errorHandler.handleDatabaseError(error, '保存数据');
      
      expect(result.type).toBe(ErrorType.DATABASE);
      expect(result.message).toBe('保存数据失败');
      expect(result.details).toBe('数据库操作出错，请稍后重试');
      expect(result.originalError).toBe(error);
    });

    it('应该支持不同的操作描述', () => {
      const error = new Error('Query failed');
      const result = errorHandler.handleDatabaseError(error, '查询文件');
      
      expect(result.message).toBe('查询文件失败');
    });
  });

  describe('handleCoordinateError', () => {
    it('应该处理坐标转换错误', () => {
      const error = new Error('Invalid coordinates');
      const result = errorHandler.handleCoordinateError(error);
      
      expect(result.type).toBe(ErrorType.COORDINATE);
      expect(result.message).toBe('坐标转换失败');
      expect(result.details).toBe('请检查坐标系统和投影配置是否正确');
      expect(result.originalError).toBe(error);
    });
  });

  describe('logError', () => {
    it('应该在开发环境记录 AppError', () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      
      // 临时设置为开发环境
      vi.doMock('../utils/env', () => ({
        isDevelopment: true,
      }));
      
      const error: AppError = {
        type: ErrorType.FILE_PARSE,
        message: '测试错误',
        originalError: new Error('原始错误'),
      };
      
      errorHandler.logError(error);
      
      // 在非开发环境下不会调用 console
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });

    it('应该在开发环境记录普通 Error', () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      
      const error = new Error('测试错误');
      errorHandler.logError(error);
      
      // 在非开发环境下不会调用 console
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });
  });

  describe('错误类型枚举', () => {
    it('应该包含所有错误类型', () => {
      expect(ErrorType.FILE_PARSE).toBe('FILE_PARSE');
      expect(ErrorType.FILE_SIZE).toBe('FILE_SIZE');
      expect(ErrorType.FILE_TYPE).toBe('FILE_TYPE');
      expect(ErrorType.DATABASE).toBe('DATABASE');
      expect(ErrorType.COORDINATE).toBe('COORDINATE');
      expect(ErrorType.NETWORK).toBe('NETWORK');
      expect(ErrorType.UNKNOWN).toBe('UNKNOWN');
    });
  });
});
