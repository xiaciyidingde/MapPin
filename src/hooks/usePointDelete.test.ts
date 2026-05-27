import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePointDelete } from './usePointDelete';
import { useDataStore } from '../store';
import { App } from 'antd';

// Mock Ant Design App
vi.mock('antd', () => ({
  App: {
    useApp: vi.fn(() => ({
      message: {
        success: vi.fn(),
        error: vi.fn(),
      },
    })),
  },
}));

// Mock store
vi.mock('../store', () => ({
  useDataStore: vi.fn(),
}));

describe('usePointDelete', () => {
  const mockDeletePoint = vi.fn();
  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup store mock
    (useDataStore as any).mockImplementation((selector: any) => {
      const state = {
        deletePoint: mockDeletePoint,
      };
      return selector(state);
    });

    // Setup App mock
    (App.useApp as any).mockReturnValue({
      message: mockMessage,
    });
  });

  it('应该成功删除点位', async () => {
    mockDeletePoint.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePointDelete('file-1'));

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.handleDelete('point-1', 'P001');
    });

    expect(mockDeletePoint).toHaveBeenCalledWith('file-1', 'point-1');
    expect(mockMessage.success).toHaveBeenCalledWith('已删除点 P001');
    expect(deleteResult).toBe(true);
  });

  it('应该处理删除失败', async () => {
    mockDeletePoint.mockRejectedValue(new Error('删除失败'));

    const { result } = renderHook(() => usePointDelete('file-1'));

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.handleDelete('point-1', 'P001');
    });

    expect(mockDeletePoint).toHaveBeenCalledWith('file-1', 'point-1');
    expect(mockMessage.error).toHaveBeenCalledWith('删除失败');
    expect(deleteResult).toBe(false);
  });

  it('当 fileId 为 null 时应该返回 false', async () => {
    const { result } = renderHook(() => usePointDelete(null));

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.handleDelete('point-1', 'P001');
    });

    expect(mockDeletePoint).not.toHaveBeenCalled();
    expect(deleteResult).toBe(false);
  });

  it('应该使用 useCallback 优化性能', () => {
    const { result, rerender } = renderHook(() => usePointDelete('file-1'));
    
    const firstHandleDelete = result.current.handleDelete;
    
    rerender();
    
    const secondHandleDelete = result.current.handleDelete;
    
    // 函数引用应该保持不变
    expect(firstHandleDelete).toBe(secondHandleDelete);
  });
});
