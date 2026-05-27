import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataLoader } from './useDataLoader';
import { useDataStore, useMapStore } from '../store';

// Mock stores
vi.mock('../store', () => ({
  useDataStore: vi.fn(),
  useMapStore: vi.fn(),
}));

describe('useDataLoader', () => {
  const mockLoadFiles = vi.fn();
  const mockLoadPoints = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该在挂载时加载文件列表', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId: null };
      return selector(state);
    });

    renderHook(() => useDataLoader());

    expect(mockLoadFiles).toHaveBeenCalledTimes(1);
  });

  it('应该在有当前文件时加载点位数据', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId: 'file1' };
      return selector(state);
    });

    renderHook(() => useDataLoader());

    expect(mockLoadPoints).toHaveBeenCalledWith('file1');
  });

  it('应该在没有当前文件时不加载点位数据', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId: null };
      return selector(state);
    });

    renderHook(() => useDataLoader());

    expect(mockLoadPoints).not.toHaveBeenCalled();
  });

  it('应该在当前文件改变时重新加载点位数据', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    let currentFileId: string | null = 'file1';
    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId };
      return selector(state);
    });

    const { rerender } = renderHook(() => useDataLoader());

    expect(mockLoadPoints).toHaveBeenCalledWith('file1');
    expect(mockLoadPoints).toHaveBeenCalledTimes(1);

    // Change current file
    currentFileId = 'file2';
    rerender();

    expect(mockLoadPoints).toHaveBeenCalledWith('file2');
    expect(mockLoadPoints).toHaveBeenCalledTimes(2);
  });

  it('应该返回当前文件 ID', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId: 'file1' };
      return selector(state);
    });

    const { result } = renderHook(() => useDataLoader());

    expect(result.current.currentFileId).toBe('file1');
  });

  it('应该在文件 ID 变为 null 时停止加载点位', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        loadFiles: mockLoadFiles,
        loadPoints: mockLoadPoints,
      };
      return selector(state);
    });

    let currentFileId: string | null = 'file1';
    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = { currentFileId };
      return selector(state);
    });

    const { rerender } = renderHook(() => useDataLoader());

    expect(mockLoadPoints).toHaveBeenCalledWith('file1');
    mockLoadPoints.mockClear();

    // Change to null
    currentFileId = null;
    rerender();

    expect(mockLoadPoints).not.toHaveBeenCalled();
  });
});
