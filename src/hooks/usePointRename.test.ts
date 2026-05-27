import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePointRename } from './usePointRename';
import { useDataStore } from '../store/useDataStore';
import { App } from 'antd';
import type { MeasurementPoint } from '../types';

// Mock validation utilities with hoisted variables
const { mockValidatePointNumber, mockIsValidPointNumber } = vi.hoisted(() => ({
  mockValidatePointNumber: vi.fn(),
  mockIsValidPointNumber: vi.fn(),
}));

// Mock stores
vi.mock('../store/useDataStore', () => ({
  useDataStore: vi.fn(),
}));

// Mock Ant Design App
vi.mock('antd', () => ({
  App: {
    useApp: vi.fn(),
  },
}));

vi.mock('../utils/pointValidation', () => ({
  validatePointNumber: mockValidatePointNumber,
}));

vi.mock('../utils/sanitize', () => ({
  isValidPointNumber: mockIsValidPointNumber,
}));

describe('usePointRename', () => {
  const mockUpdatePoint = vi.fn();
  const mockMessageSuccess = vi.fn();
  const mockMessageError = vi.fn();

  const mockPoint: MeasurementPoint = {
    id: 'p1',
    fileId: 'file1',
    pointNumber: 'P001',
    originalPointNumber: 'P001',
    x: 100,
    y: 200,
    z: 10,
    code: 'A',
    type: 'survey',
    order: 0,
  };

  const mockPoints = [mockPoint];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useDataStore
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        points: new Map([['file1', mockPoints]]),
        updatePoint: mockUpdatePoint,
      };
      return selector(state);
    });

    // Mock App.useApp
    vi.mocked(App.useApp).mockReturnValue({
      message: {
        success: mockMessageSuccess,
        error: mockMessageError,
      },
    } as any);

    // Mock validation
    mockValidatePointNumber.mockReturnValue({ valid: true });
    mockIsValidPointNumber.mockReturnValue(true);
  });

  describe('openRenameModal', () => {
    it('应该打开重命名对话框并设置初始值', () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
      });

      expect(result.current.renameModalOpen).toBe(true);
      expect(result.current.renamingPoint).toEqual(mockPoint);
      expect(result.current.newPointNumber).toBe('P001');
      expect(result.current.newCode).toBe('A');
    });

    it('应该处理没有编码的点位', () => {
      const pointWithoutCode = { ...mockPoint, code: undefined };
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(pointWithoutCode);
      });

      expect(result.current.newCode).toBe('');
    });
  });

  describe('closeRenameModal', () => {
    it('应该关闭对话框并重置状态', () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
      });

      expect(result.current.renameModalOpen).toBe(true);

      act(() => {
        result.current.closeRenameModal();
      });

      expect(result.current.renameModalOpen).toBe(false);
      expect(result.current.renamingPoint).toBeNull();
      expect(result.current.newPointNumber).toBe('');
      expect(result.current.newCode).toBe('');
    });
  });

  describe('confirmRename', () => {
    it('应该在没有文件 ID 时不执行', async () => {
      const { result } = renderHook(() => usePointRename(null));

      act(() => {
        result.current.openRenameModal(mockPoint);
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).not.toHaveBeenCalled();
    });

    it('应该在点号为空时显示错误', async () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('   ');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockMessageError).toHaveBeenCalledWith('点号不能为空');
      expect(mockUpdatePoint).not.toHaveBeenCalled();
    });

    it('应该在点号格式不正确时显示错误', async () => {
      mockIsValidPointNumber.mockReturnValue(false);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('P@001');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockMessageError).toHaveBeenCalledWith(
        '点号格式不正确，只允许字母、数字、中文、下划线和连字符'
      );
      expect(mockUpdatePoint).not.toHaveBeenCalled();
    });

    it('应该在点号和编码都没变化时直接关闭', async () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(result.current.renameModalOpen).toBe(false);
      expect(mockUpdatePoint).not.toHaveBeenCalled();
    });

    it('应该在点号重复时显示错误', async () => {
      mockValidatePointNumber.mockReturnValue({
        valid: false,
        error: '点号 P002 已存在',
      });

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('P002');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockMessageError).toHaveBeenCalledWith('点号 P002 已存在');
      expect(mockUpdatePoint).not.toHaveBeenCalled();
    });

    it('应该成功更新点号', async () => {
      mockUpdatePoint.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('P002');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).toHaveBeenCalledWith('file1', 'p1', {
        pointNumber: 'P002',
      });
      expect(mockMessageSuccess).toHaveBeenCalledWith('已更新 点号: P001 → P002');
      expect(result.current.renameModalOpen).toBe(false);
    });

    it('应该成功更新编码', async () => {
      mockUpdatePoint.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewCode('B');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).toHaveBeenCalledWith('file1', 'p1', {
        code: 'B',
      });
      expect(mockMessageSuccess).toHaveBeenCalledWith('已更新 编码: A → B');
    });

    it('应该同时更新点号和编码', async () => {
      mockUpdatePoint.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('P002');
        result.current.setNewCode('B');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).toHaveBeenCalledWith('file1', 'p1', {
        pointNumber: 'P002',
        code: 'B',
      });
      expect(mockMessageSuccess).toHaveBeenCalledWith('已更新 点号: P001 → P002, 编码: A → B');
    });

    it('应该处理清空编码', async () => {
      mockUpdatePoint.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewCode('');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).toHaveBeenCalledWith('file1', 'p1', {
        code: undefined,
      });
      expect(mockMessageSuccess).toHaveBeenCalledWith('已更新 编码: A → 无');
    });

    it('应该处理更新失败', async () => {
      mockUpdatePoint.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('P002');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockMessageError).toHaveBeenCalledWith('重命名失败');
      expect(result.current.renameModalOpen).toBe(true);
    });

    it('应该修剪空白字符', async () => {
      mockUpdatePoint.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.openRenameModal(mockPoint);
        result.current.setNewPointNumber('  P002  ');
        result.current.setNewCode('  B  ');
      });

      await act(async () => {
        await result.current.confirmRename();
      });

      expect(mockUpdatePoint).toHaveBeenCalledWith('file1', 'p1', {
        pointNumber: 'P002',
        code: 'B',
      });
    });
  });

  describe('setters', () => {
    it('应该更新点号', () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.setNewPointNumber('P999');
      });

      expect(result.current.newPointNumber).toBe('P999');
    });

    it('应该更新编码', () => {
      const { result } = renderHook(() => usePointRename('file1'));

      act(() => {
        result.current.setNewCode('Z');
      });

      expect(result.current.newCode).toBe('Z');
    });
  });
});
