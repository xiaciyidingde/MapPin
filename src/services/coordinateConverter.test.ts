import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinateConverter } from './coordinateConverter';
import { useSettingsStore } from '../store';

// Mock proj4 - 使用 vi.hoisted 解决变量提升问题
const { mockProj4 } = vi.hoisted(() => {
  const mockProj4: any = vi.fn((from: string, to: string, coords: number[]) => {
    // 简单的模拟转换逻辑
    if (from === 'WGS84' && to !== 'WGS84') {
      // WGS84 -> 投影坐标：返回 [Y, X] 格式
      return [coords[0] * 100000, coords[1] * 100000];
    } else if (from !== 'WGS84' && to === 'WGS84') {
      // 投影坐标 -> WGS84：返回 [lng, lat] 格式
      return [coords[0] / 100000, coords[1] / 100000];
    }
    return coords;
  });

  mockProj4.defs = vi.fn();

  return { mockProj4 };
});

vi.mock('proj4', () => ({
  default: mockProj4,
}));

describe('CoordinateConverter', () => {
  let converter: CoordinateConverter;

  beforeEach(() => {
    converter = new CoordinateConverter();
    vi.clearAllMocks();

    // Mock useSettingsStore
    vi.spyOn(useSettingsStore, 'getState').mockReturnValue({
      centralMeridian: 117,
      projectionType: 'gauss-3',
    } as Partial<ReturnType<typeof useSettingsStore.getState>> as ReturnType<typeof useSettingsStore.getState>);
  });

  describe('getSupportedSystems', () => {
    it('应该返回支持的坐标系统列表', () => {
      const systems = converter.getSupportedSystems();

      expect(systems).toEqual(['CGCS2000', 'Beijing54', 'Xian80', 'WGS84']);
    });
  });

  describe('projectToWGS84', () => {
    it('应该处理 WGS84 坐标系（无需转换）', () => {
      const result = converter.projectToWGS84(116.4074, 39.9042, 'WGS84');

      expect(result).toEqual({
        lat: 39.9042,
        lng: 116.4074,
      });
    });

    it('应该将投影坐标转换为 WGS84', () => {
      const result = converter.projectToWGS84(500000, 4000000, 'CGCS2000');

      expect(result).toEqual({
        lat: 5,
        lng: 40,
      });
    });

    it('应该使用提供的投影参数', () => {
      const result = converter.projectToWGS84(
        500000,
        4000000,
        'CGCS2000',
        'gauss-6',
        120
      );

      expect(result).toEqual({
        lat: 5,
        lng: 40,
      });
    });

    it('应该在转换失败时返回原始坐标', () => {
      mockProj4.mockImplementationOnce(() => {
        throw new Error('Conversion failed');
      });

      const result = converter.projectToWGS84(500000, 4000000, 'CGCS2000');

      expect(result).toEqual({
        lat: 4000000,
        lng: 500000,
      });
    });
  });

  describe('projectFromWGS84', () => {
    it('应该处理 WGS84 坐标系（无需转换）', () => {
      const result = converter.projectFromWGS84(39.9042, 116.4074, 'WGS84');

      expect(result).toEqual({
        x: 116.4074,
        y: 39.9042,
      });
    });

    it('应该将 WGS84 转换为投影坐标', () => {
      const result = converter.projectFromWGS84(39.9042, 116.4074, 'CGCS2000');

      expect(result.x).toBeCloseTo(3990420);
      expect(result.y).toBe(11640740);
    });

    it('应该使用提供的投影参数', () => {
      const result = converter.projectFromWGS84(
        39.9042,
        116.4074,
        'CGCS2000',
        'gauss-6',
        120
      );

      expect(result.x).toBeCloseTo(3990420);
      expect(result.y).toBe(11640740);
    });

    it('应该在转换失败时返回原始坐标', () => {
      mockProj4.mockImplementationOnce(() => {
        throw new Error('Conversion failed');
      });

      const result = converter.projectFromWGS84(39.9042, 116.4074, 'CGCS2000');

      expect(result).toEqual({
        x: 116.4074,
        y: 39.9042,
      });
    });

    it('应该处理中央经线为 0 的情况', () => {
      const result = converter.projectFromWGS84(
        39.9042,
        116.4074,
        'CGCS2000',
        'gauss-3',
        0
      );

      expect(result.x).toBeCloseTo(3990420);
      expect(result.y).toBe(11640740);
    });
  });

  describe('updateFromSettings', () => {
    it('应该从设置存储中更新投影配置', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      converter.updateFromSettings();

      expect(useSettingsStore.getState).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('投影配置已更新')
      );

      consoleSpy.mockRestore();
    });
  });
});
