import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSwitch } from './useFileSwitch';
import { useMapStore, useDataStore } from '../store';
import { App } from 'antd';

// Mock stores
vi.mock('../store', () => ({
  useMapStore: vi.fn(),
  useDataStore: vi.fn(),
}));

// Mock Ant Design App
vi.mock('antd', () => ({
  App: {
    useApp: vi.fn(),
  },
}));

describe('useFileSwitch', () => {
  const mockSetCurrentFileId = vi.fn();
  const mockTriggerFitToView = vi.fn();
  const mockModalConfirm = vi.fn();

  const mockFiles = [
    {
      id: 'file1',
      name: '测试文件1.dat',
      uploadTime: Date.now(),
      format: 'simple' as const,
      coordinateSystem: 'CGCS2000' as const,
      projectionConfig: {
        coordinateSystem: 'CGCS2000' as const,
        projectionType: 'gauss-3' as const,
        centralMeridian: 117,
      },
      pointCount: 10,
      controlPointCount: 2,
      surveyPointCount: 8,
    },
    {
      id: 'file2',
      name: '测试文件2.dat',
      uploadTime: Date.now(),
      format: 'simple' as const,
      coordinateSystem: 'CGCS2000' as const,
      projectionConfig: {
        coordinateSystem: 'CGCS2000' as const,
        projectionType: 'gauss-3' as const,
        centralMeridian: 117,
      },
      pointCount: 5,
      controlPointCount: 1,
      surveyPointCount: 4,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useMapStore
    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = {
        currentFileId: 'file1',
        setCurrentFileId: mockSetCurrentFileId,
        triggerFitToView: mockTriggerFitToView,
      };
      return selector(state);
    });

    // Mock useDataStore
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        files: mockFiles,
      };
      return selector(state);
    });

    // Mock App.useApp
    vi.mocked(App.useApp).mockReturnValue({
      modal: {
        confirm: mockModalConfirm,
      },
    } as any);

    // Mock setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('switchToFile', () => {
    it('应该直接切换文件（无确认）', () => {
      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2');
      });

      expect(mockSetCurrentFileId).toHaveBeenCalledWith('file2');
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      expect(mockTriggerFitToView).toHaveBeenCalled();
    });

    it('应该在没有当前文件时直接切换', () => {
      // Mock no current file
      vi.mocked(useMapStore).mockImplementation((selector: any) => {
        const state = {
          currentFileId: null,
          setCurrentFileId: mockSetCurrentFileId,
          triggerFitToView: mockTriggerFitToView,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2', { confirm: true });
      });

      expect(mockSetCurrentFileId).toHaveBeenCalledWith('file2');
      expect(mockModalConfirm).not.toHaveBeenCalled();
    });

    it('应该显示确认对话框', () => {
      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2', { confirm: true });
      });

      expect(mockModalConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '已有打开的文件',
          content: '当前已打开文件「测试文件1.dat」，是否切换到「测试文件2.dat」？',
          okText: '切换',
          cancelText: '取消',
          centered: true,
        })
      );
    });

    it('应该支持自定义确认对话框文本', () => {
      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2', {
          confirm: true,
          confirmTitle: '自定义标题',
          confirmContent: '自定义内容',
          okText: '确定',
          cancelText: '返回',
        });
      });

      expect(mockModalConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '自定义标题',
          content: '自定义内容',
          okText: '确定',
          cancelText: '返回',
        })
      );
    });

    it('应该在确认后切换文件', () => {
      mockModalConfirm.mockImplementation((config: any) => {
        config.onOk();
      });

      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2', { confirm: true });
      });

      expect(mockSetCurrentFileId).toHaveBeenCalledWith('file2');
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      expect(mockTriggerFitToView).toHaveBeenCalled();
    });

    it('应该调用 onConfirm 回调', () => {
      const onConfirm = vi.fn();
      mockModalConfirm.mockImplementation((config: any) => {
        config.onOk();
      });

      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('file2', {
          confirm: true,
          onConfirm,
        });
      });

      expect(onConfirm).toHaveBeenCalled();
    });

    it('应该处理不存在的文件', () => {
      const { result } = renderHook(() => useFileSwitch());

      act(() => {
        result.current.switchToFile('nonexistent', { confirm: true });
      });

      expect(mockModalConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('新文件'),
        })
      );
    });
  });
});
