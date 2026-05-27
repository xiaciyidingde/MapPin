import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncOperation } from './useAsyncOperation';
import { message } from 'antd';
import { errorHandler } from '../services/errorHandler';

// Mock antd message
vi.mock('antd', () => ({
  message: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    destroy: vi.fn(),
  },
}));

// Mock errorHandler
vi.mock('../services/errorHandler', () => ({
  errorHandler: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
    logError: vi.fn(),
  },
}));

describe('useAsyncOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('应该执行异步操作并返回结果', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.execute('arg1', 'arg2');
      });

      expect(mockOperation).toHaveBeenCalledWith('arg1', 'arg2');
      expect(returnValue).toBe('success');
    });

    it('应该在执行期间设置 loading 状态', async () => {
      const mockOperation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 100))
      );
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.execute();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('应该在成功时显示成功消息', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          successMessage: '操作成功',
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(errorHandler.showSuccess).toHaveBeenCalledWith('操作成功');
    });

    it('应该在失败时显示错误消息', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          errorMessage: '自定义错误消息',
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(errorHandler.showError).toHaveBeenCalledWith('自定义错误消息');
    });

    it('应该在失败时使用默认错误消息', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      await act(async () => {
        await result.current.execute();
      });

      expect(errorHandler.showError).toHaveBeenCalledWith('操作失败');
    });

    it('应该在失败时设置 error 状态', async () => {
      const error = new Error('操作失败');
      const mockOperation = vi.fn().mockRejectedValue(error);
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toEqual(error);
    });

    it('应该在失败时记录错误', async () => {
      const error = new Error('操作失败');
      const mockOperation = vi.fn().mockRejectedValue(error);
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      await act(async () => {
        await result.current.execute();
      });

      expect(errorHandler.logError).toHaveBeenCalledWith(error);
    });

    it('应该在失败时返回 null', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.execute();
      });

      expect(returnValue).toBeNull();
    });

    it('应该显示 loading 消息', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          showLoading: true,
          loadingMessage: '处理中...',
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(message.loading).toHaveBeenCalledWith({
        content: '处理中...',
        key: 'async-operation',
        duration: 0,
      });
    });

    it('应该使用默认 loading 消息', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          showLoading: true,
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(message.loading).toHaveBeenCalledWith({
        content: '处理中...',
        key: 'async-operation',
        duration: 0,
      });
    });

    it('应该在成功时替换 loading 消息为成功消息', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          showLoading: true,
          successMessage: '操作成功',
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(message.success).toHaveBeenCalledWith({
        content: '操作成功',
        key: 'async-operation',
      });
    });

    it('应该在失败时替换 loading 消息为错误消息', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          showLoading: true,
          errorMessage: '自定义错误',
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(message.error).toHaveBeenCalledWith({
        content: '自定义错误',
        key: 'async-operation',
      });
    });

    it('应该在成功但没有成功消息时销毁 loading', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const { result } = renderHook(() =>
        useAsyncOperation(mockOperation, {
          showLoading: true,
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(message.destroy).toHaveBeenCalledWith('async-operation');
    });

    it('应该处理非 Error 对象的错误', async () => {
      const mockOperation = vi.fn().mockRejectedValue('string error');
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toEqual(new Error('未知错误'));
    });

    it('应该在每次执行时清除之前的错误', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('第一次失败'))
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      // First execution - fails
      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeTruthy();

      // Second execution - succeeds
      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('应该重置错误和 loading 状态', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });
});
