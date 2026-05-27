import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAndGetPoints, loadAndGetMultiplePoints } from './dataUtils';
import { useDataStore } from '../store/useDataStore';
import type { MeasurementPoint } from '../types';

// Mock useDataStore
vi.mock('../store/useDataStore', () => ({
  useDataStore: {
    getState: vi.fn(),
  },
}));

const mockPoints: MeasurementPoint[] = [
  {
    id: 'p1',
    fileId: 'file1',
    pointNumber: '1',
    originalPointNumber: '1',
    x: 100,
    y: 200,
    z: 10,
    lat: 39.9,
    lng: 116.4,
    type: 'survey',
    order: 0,
  },
  {
    id: 'p2',
    fileId: 'file1',
    pointNumber: '2',
    originalPointNumber: '2',
    x: 150,
    y: 250,
    z: 15,
    lat: 39.91,
    lng: 116.41,
    type: 'survey',
    order: 1,
  },
];

describe('dataUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadAndGetPoints', () => {
    it('应该加载并返回点位数据', async () => {
      const mockLoadPoints = vi.fn(async () => {
        // Simulate loading points into the store
        const mockPointsMap = new Map([['file1', mockPoints]]);
        vi.mocked(useDataStore.getState).mockReturnValue({
          points: mockPointsMap,
        } as Partial<ReturnType<typeof useDataStore.getState>> as ReturnType<typeof useDataStore.getState>);
      });

      const result = await loadAndGetPoints('file1', mockLoadPoints);

      expect(mockLoadPoints).toHaveBeenCalledWith('file1');
      expect(result).toEqual(mockPoints);
    });

    it('应该在文件不存在时返回空数组', async () => {
      const mockLoadPoints = vi.fn(async () => {
        const mockPointsMap = new Map();
        vi.mocked(useDataStore.getState).mockReturnValue({
          points: mockPointsMap,
        } as Partial<ReturnType<typeof useDataStore.getState>> as ReturnType<typeof useDataStore.getState>);
      });

      const result = await loadAndGetPoints('nonexistent', mockLoadPoints);

      expect(result).toEqual([]);
    });

    it('应该处理加载错误', async () => {
      const mockLoadPoints = vi.fn().mockRejectedValue(new Error('Load failed'));

      await expect(loadAndGetPoints('file1', mockLoadPoints)).rejects.toThrow('Load failed');
    });
  });

  describe('loadAndGetMultiplePoints', () => {
    it('应该加载并返回多个文件的点位数据', async () => {
      const file2Points: MeasurementPoint[] = [
        { ...mockPoints[0], id: 'p3', fileId: 'file2' },
      ];
      
      let callCount = 0;
      const mockLoadPoints = vi.fn(async () => {
        callCount++;
        const pointsMap = new Map();
        if (callCount === 1) {
          pointsMap.set('file1', mockPoints);
        } else if (callCount === 2) {
          pointsMap.set('file1', mockPoints);
          pointsMap.set('file2', file2Points);
        }
        vi.mocked(useDataStore.getState).mockReturnValue({
          points: pointsMap,
        } as Partial<ReturnType<typeof useDataStore.getState>> as ReturnType<typeof useDataStore.getState>);
      });

      const result = await loadAndGetMultiplePoints(['file1', 'file2'], mockLoadPoints);

      expect(mockLoadPoints).toHaveBeenCalledTimes(2);
      expect(result.size).toBe(2);
      expect(result.get('file1')).toEqual(mockPoints);
      expect(result.get('file2')).toEqual(file2Points);
    });

    it('应该处理空文件列表', async () => {
      const mockLoadPoints = vi.fn();

      const result = await loadAndGetMultiplePoints([], mockLoadPoints);

      expect(mockLoadPoints).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });

    it('应该处理部分文件加载失败', async () => {
      const mockLoadPoints = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Load failed'));

      await expect(
        loadAndGetMultiplePoints(['file1', 'file2'], mockLoadPoints)
      ).rejects.toThrow('Load failed');
    });
  });
});
