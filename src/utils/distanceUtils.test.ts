import { describe, it, expect } from 'vitest';
import { calculatePlaneDistance, calculateHaversineDistance } from './distanceUtils';

describe('distanceUtils', () => {
  describe('calculatePlaneDistance', () => {
    it('应该计算平面距离', () => {
      const distance = calculatePlaneDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
      
      expect(distance).toBe(5); // 3-4-5 直角三角形
    });

    it('应该处理相同点', () => {
      const distance = calculatePlaneDistance({ x: 100, y: 200 }, { x: 100, y: 200 });
      
      expect(distance).toBe(0);
    });

    it('应该处理负坐标', () => {
      const distance = calculatePlaneDistance({ x: -3, y: -4 }, { x: 0, y: 0 });
      
      expect(distance).toBe(5);
    });

    it('应该处理大坐标值', () => {
      const distance = calculatePlaneDistance({ x: 500000, y: 3500000 }, { x: 500100, y: 3500000 });
      
      expect(distance).toBe(100);
    });

    it('应该返回正数', () => {
      const distance = calculatePlaneDistance({ x: 10, y: 10 }, { x: 5, y: 5 });
      
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('calculateHaversineDistance', () => {
    it('应该计算球面距离（北京到上海）', () => {
      // 北京: 39.9042°N, 116.4074°E
      // 上海: 31.2304°N, 121.4737°E
      const distance = calculateHaversineDistance(
        { lat: 39.9042, lng: 116.4074 },
        { lat: 31.2304, lng: 121.4737 }
      );
      
      // 实际距离约 1067 km
      expect(distance).toBeGreaterThan(1000000); // 1000 km
      expect(distance).toBeLessThan(1200000); // 1200 km
    });

    it('应该处理相同点', () => {
      const distance = calculateHaversineDistance(
        { lat: 31.5, lng: 117.2 },
        { lat: 31.5, lng: 117.2 }
      );
      
      expect(distance).toBe(0);
    });

    it('应该处理赤道上的点', () => {
      const distance = calculateHaversineDistance(
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 }
      );
      
      // 赤道上 1 度约 111 km
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('应该处理跨越本初子午线的点', () => {
      const distance = calculateHaversineDistance(
        { lat: 51.5, lng: -0.1 },
        { lat: 51.5, lng: 0.1 }
      );
      
      expect(distance).toBeGreaterThan(0);
    });

    it('应该处理南北半球的点', () => {
      const distance = calculateHaversineDistance(
        { lat: 30, lng: 120 },
        { lat: -30, lng: 120 }
      );
      
      // 纬度相差 60 度
      expect(distance).toBeGreaterThan(6000000); // 6000 km
    });

    it('应该返回正数', () => {
      const distance = calculateHaversineDistance(
        { lat: 31.5, lng: 117.2 },
        { lat: 31.6, lng: 117.3 }
      );
      
      expect(distance).toBeGreaterThan(0);
    });

    it('应该处理极点附近的点', () => {
      const distance = calculateHaversineDistance(
        { lat: 89, lng: 0 },
        { lat: 89, lng: 180 }
      );
      
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('距离计算一致性', () => {
    it('平面距离和球面距离应该在小范围内接近', () => {
      // 在小范围内（几百米），平面距离和球面距离应该接近
      const lat1 = 31.5;
      const lng1 = 117.2;
      const lat2 = 31.501;
      const lng2 = 117.201;

      const sphericalDist = calculateHaversineDistance(
        { lat: lat1, lng: lng1 },
        { lat: lat2, lng: lng2 }
      );
      
      // 简单的平面近似（1度纬度约111km，1度经度在31.5度纬度约95km）
      const dLat = (lat2 - lat1) * 111000;
      const dLng = (lng2 - lng1) * 95000;
      const planeDist = Math.sqrt(dLat * dLat + dLng * dLng);

      // 在小范围内，两者应该相差不大（误差小于1%）
      const error = Math.abs(sphericalDist - planeDist) / sphericalDist;
      expect(error).toBeLessThan(0.01);
    });
  });
});
