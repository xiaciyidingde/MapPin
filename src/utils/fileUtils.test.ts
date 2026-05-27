import { describe, it, expect } from 'vitest';
import { generateDefaultFileName } from './fileUtils';
import type { MeasurementFile } from '../types';

describe('fileUtils', () => {
  const mockFiles: MeasurementFile[] = [
    {
      id: 'file1',
      name: '测试文件1.dat',
      uploadTime: Date.now(),
      format: 'simple',
      coordinateSystem: 'CGCS2000',
      projectionConfig: {
        coordinateSystem: 'CGCS2000',
        projectionType: 'gauss-3',
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
      format: 'simple',
      coordinateSystem: 'CGCS2000',
      projectionConfig: {
        coordinateSystem: 'CGCS2000',
        projectionType: 'gauss-3',
        centralMeridian: 117,
      },
      pointCount: 5,
      controlPointCount: 1,
      surveyPointCount: 4,
    },
  ];

  describe('generateDefaultFileName', () => {
    it('应该使用当前文件名（不含扩展名）', () => {
      const result = generateDefaultFileName('file1', mockFiles);
      expect(result).toBe('测试文件1');
    });

    it('应该在没有当前文件时使用默认前缀和日期', () => {
      const result = generateDefaultFileName(null, mockFiles);
      expect(result).toMatch(/^导出文件_\d{8}$/);
    });

    it('应该支持自定义前缀', () => {
      const result = generateDefaultFileName(null, mockFiles, '导出');
      expect(result).toMatch(/^导出_\d{8}$/);
    });

    it('应该处理不存在的文件 ID', () => {
      const result = generateDefaultFileName('nonexistent', mockFiles);
      expect(result).toMatch(/^导出文件_\d{8}$/);
    });

    it('应该处理空文件列表', () => {
      const result = generateDefaultFileName(null, []);
      expect(result).toMatch(/^导出文件_\d{8}$/);
    });
  });
});
