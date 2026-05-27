import { describe, it, expect } from 'vitest';
import { validatePointNumber } from './pointValidation';
import type { MeasurementPoint } from '../types';

describe('pointValidation', () => {
  const mockPoints: MeasurementPoint[] = [
    {
      id: 'point-1',
      pointNumber: 'P001',
      originalPointNumber: 'P001',
      x: 100,
      y: 200,
      z: 50,
      code: 'A',
      type: 'survey',
      fileId: 'file-1',
      order: 0,
    },
    {
      id: 'point-2',
      pointNumber: 'P002',
      originalPointNumber: 'P002',
      x: 150,
      y: 250,
      z: 55,
      code: 'B',
      type: 'control',
      fileId: 'file-1',
      order: 1,
    },
  ];

  describe('validatePointNumber', () => {
    it('应该验证不重复的点号', () => {
      const result = validatePointNumber('P003', mockPoints);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该检测重复的点号', () => {
      const result = validatePointNumber('P001', mockPoints);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('点号 P001 已存在');
    });

    it('应该排除指定的点位 ID', () => {
      const result = validatePointNumber('P001', mockPoints, 'point-1');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该处理空点号', () => {
      const result = validatePointNumber('', mockPoints);
      
      expect(result.valid).toBe(true);
    });

    it('应该处理空点位列表', () => {
      const result = validatePointNumber('P001', []);
      
      expect(result.valid).toBe(true);
    });

    it('应该区分大小写', () => {
      const result = validatePointNumber('p001', mockPoints);
      
      expect(result.valid).toBe(true);
    });
  });
});
