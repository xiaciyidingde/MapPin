import { describe, it, expect } from 'vitest';
import { convertCoordinatesForFile, convertCoordinatesToWGS84ForFile } from './coordinateUtils';
import type { MeasurementFile } from '../types';

const mockFile: MeasurementFile = {
  id: 'test-file',
  name: 'test.dat',
  uploadTime: Date.now(),
  format: 'simple',
  coordinateSystem: 'CGCS2000',
  projectionConfig: {
    coordinateSystem: 'CGCS2000',
    projectionType: 'gauss-3',
    centralMeridian: 117,
  },
  pointCount: 0,
  controlPointCount: 0,
  surveyPointCount: 0,
};

describe('coordinateUtils', () => {
  describe('convertCoordinatesToWGS84ForFile', () => {
    it('应该将投影坐标转换为 WGS84', () => {
      const result = convertCoordinatesToWGS84ForFile(500000, 4000000, mockFile);
      expect(result).toHaveProperty('lat');
      expect(result).toHaveProperty('lng');
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
    });

    it('应该返回有效的纬度范围', () => {
      const result = convertCoordinatesToWGS84ForFile(500000, 4000000, mockFile);
      expect(result.lat).toBeGreaterThanOrEqual(-90);
      expect(result.lat).toBeLessThanOrEqual(90);
    });

    it('应该返回有效的经度范围', () => {
      const result = convertCoordinatesToWGS84ForFile(500000, 4000000, mockFile);
      expect(result.lng).toBeGreaterThanOrEqual(-180);
      expect(result.lng).toBeLessThanOrEqual(180);
    });
  });

  describe('convertCoordinatesForFile', () => {
    it('应该将 WGS84 坐标转换为投影坐标', () => {
      const result = convertCoordinatesForFile(36.0, 117.0, mockFile);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('应该返回合理的投影坐标值', () => {
      const result = convertCoordinatesForFile(36.0, 117.0, mockFile);
      expect(Math.abs(result.x)).toBeGreaterThan(0);
      expect(Math.abs(result.y)).toBeGreaterThan(0);
    });

    it('转换应该是可逆的', () => {
      const original = { lat: 36.0, lng: 117.0 };
      const projected = convertCoordinatesForFile(original.lat, original.lng, mockFile);
      const converted = convertCoordinatesToWGS84ForFile(projected.x, projected.y, mockFile);
      
      expect(converted.lat).toBeCloseTo(original.lat, 5);
      expect(converted.lng).toBeCloseTo(original.lng, 5);
    });
  });
});
