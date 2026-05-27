import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNextPointNumber } from './useNextPointNumber';
import { useDataStore } from '../store/useDataStore';
import type { MeasurementPoint } from '../types';

// Mock useDataStore
vi.mock('../store/useDataStore', () => ({
  useDataStore: vi.fn(),
}));

describe('useNextPointNumber', () => {
  const createMockPoint = (id: string, pointNumber: string): MeasurementPoint => ({
    id,
    fileId: 'file1',
    pointNumber,
    originalPointNumber: pointNumber,
    x: 100,
    y: 200,
    z: 10,
    type: 'survey',
    order: 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该在没有文件 ID 时返回 "1"', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map() };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber(null));

    expect(result.current).toBe('1');
  });

  it('应该在文件没有点位时返回 "1"', () => {
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map() };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('1');
  });

  it('应该返回最大点号 + 1', () => {
    const mockPoints = [
      createMockPoint('p1', '1'),
      createMockPoint('p2', '5'),
      createMockPoint('p3', '3'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints]]) };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('6');
  });

  it('应该忽略非数字点号', () => {
    const mockPoints = [
      createMockPoint('p1', '1'),
      createMockPoint('p2', 'A1'),
      createMockPoint('p3', '5'),
      createMockPoint('p4', 'P001'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints]]) };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('6');
  });

  it('应该在只有非数字点号时返回 "1"', () => {
    const mockPoints = [
      createMockPoint('p1', 'A1'),
      createMockPoint('p2', 'B2'),
      createMockPoint('p3', 'P001'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints]]) };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('1');
  });

  it('应该处理大数字点号', () => {
    const mockPoints = [
      createMockPoint('p1', '100'),
      createMockPoint('p2', '999'),
      createMockPoint('p3', '500'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints]]) };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('1000');
  });

  it('应该处理带前导零的点号', () => {
    const mockPoints = [
      createMockPoint('p1', '001'),
      createMockPoint('p2', '005'),
      createMockPoint('p3', '010'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints]]) };
      return selector(state);
    });

    const { result } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('11');
  });

  it('应该在点位更新时重新计算', () => {
    const mockPoints1 = [
      createMockPoint('p1', '1'),
      createMockPoint('p2', '2'),
    ];

    const mockPoints2 = [
      createMockPoint('p1', '1'),
      createMockPoint('p2', '2'),
      createMockPoint('p3', '10'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints1]]) };
      return selector(state);
    });

    const { result, rerender } = renderHook(() => useNextPointNumber('file1'));

    expect(result.current).toBe('3');

    // Update points
    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = { points: new Map([['file1', mockPoints2]]) };
      return selector(state);
    });

    rerender();

    expect(result.current).toBe('11');
  });

  it('应该为不同文件返回不同的点号', () => {
    const mockPointsFile1 = [
      createMockPoint('p1', '1'),
      createMockPoint('p2', '5'),
    ];

    const mockPointsFile2 = [
      createMockPoint('p3', '10'),
      createMockPoint('p4', '20'),
    ];

    vi.mocked(useDataStore).mockImplementation((selector: any) => {
      const state = {
        points: new Map([
          ['file1', mockPointsFile1],
          ['file2', mockPointsFile2],
        ]),
      };
      return selector(state);
    });

    const { result: result1 } = renderHook(() => useNextPointNumber('file1'));
    const { result: result2 } = renderHook(() => useNextPointNumber('file2'));

    expect(result1.current).toBe('6');
    expect(result2.current).toBe('21');
  });
});
