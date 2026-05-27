import { describe, it, expect, vi } from 'vitest';
import { fitMapToPoints, createVirtualPoint } from './mapUtils';
import type { MeasurementPoint } from '../types';

// Mock Leaflet Map
const createMockMap = () => ({
  fitBounds: vi.fn(),
  setView: vi.fn(),
  getZoom: vi.fn().mockReturnValue(13),
});

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

describe('mapUtils', () => {
  describe('fitMapToPoints', () => {
    it('应该调用 fitBounds 当有有效点位时', () => {
      const mockMap = createMockMap();
      fitMapToPoints(mockMap as any, mockPoints);

      expect(mockMap.fitBounds).toHaveBeenCalledWith(
        expect.arrayContaining([
          [39.9, 116.4],
          [39.91, 116.41],
        ]),
        expect.objectContaining({
          padding: [50, 50],
          maxZoom: 24,
        })
      );
    });

    it('应该支持自定义选项', () => {
      const mockMap = createMockMap();
      fitMapToPoints(mockMap as any, mockPoints, {
        padding: [100, 100],
        maxZoom: 18,
      });

      expect(mockMap.fitBounds).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          padding: [100, 100],
          maxZoom: 18,
        })
      );
    });

    it('应该忽略没有经纬度的点位', () => {
      const mockMap = createMockMap();
      const pointsWithInvalid = [
        ...mockPoints,
        { ...mockPoints[0], id: 'p3', lat: undefined, lng: undefined },
      ];

      fitMapToPoints(mockMap as any, pointsWithInvalid);

      expect(mockMap.fitBounds).toHaveBeenCalledWith(
        expect.arrayContaining([
          [39.9, 116.4],
          [39.91, 116.41],
        ]),
        expect.any(Object)
      );
    });

    it('应该在没有有效点位时不调用 fitBounds', () => {
      const mockMap = createMockMap();
      const invalidPoints = [
        { ...mockPoints[0], lat: undefined, lng: undefined },
      ];

      fitMapToPoints(mockMap as any, invalidPoints);

      expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it('应该处理空数组', () => {
      const mockMap = createMockMap();
      fitMapToPoints(mockMap as any, []);

      expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });
  });

  describe('createVirtualPoint', () => {
    it('应该创建虚拟点位对象', () => {
      const result = createVirtualPoint('virtual-1', '用户位置', 31.5, 117.2);

      expect(result).toMatchObject({
        id: 'virtual-1',
        fileId: 'virtual',
        pointNumber: '用户位置',
        originalPointNumber: '用户位置',
        lat: 31.5,
        lng: 117.2,
        x: 117.2, // lng as x
        y: 31.5,  // lat as y
        z: 0,
        type: 'survey',
        order: -1,
      });
    });

    it('应该使用经度作为 x 坐标', () => {
      const result = createVirtualPoint('virtual-1', 'Point', 31.5, 117.2);
      expect(result.x).toBe(117.2);
    });

    it('应该使用纬度作为 y 坐标', () => {
      const result = createVirtualPoint('virtual-1', 'Point', 31.5, 117.2);
      expect(result.y).toBe(31.5);
    });

    it('应该设置高程为 0', () => {
      const result = createVirtualPoint('virtual-1', 'Point', 31.5, 117.2);
      expect(result.z).toBe(0);
    });

    it('应该设置虚拟顺序为 -1', () => {
      const result = createVirtualPoint('virtual-1', 'Point', 31.5, 117.2);
      expect(result.order).toBe(-1);
    });
  });
});
