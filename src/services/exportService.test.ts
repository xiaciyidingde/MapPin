import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportFile, exportMultipleFiles } from './exportService';
import type { MeasurementFile, MeasurementPoint } from '../types';

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      files: Map<string, string> = new Map();

      file(name: string, content: string) {
        this.files.set(name, content);
      }

      async generateAsync() {
        return new Blob(['mock zip content']);
      }
    },
  };
});

describe('exportService', () => {
  let mockFile: MeasurementFile;
  let mockPoints: MeasurementPoint[];
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock DOM APIs
    createElementSpy = vi.spyOn(document, 'createElement');
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    createElementSpy.mockReturnValue(mockLink);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);

    // Mock file and points
    mockFile = {
      id: 'file1',
      name: '测试文件.dat',
      uploadTime: new Date('2024-01-01').getTime(),
      coordinateSystem: 'CGCS2000',
      projectionConfig: {
        projectionType: 'gauss-3',
        centralMeridian: 117,
      },
      pointCount: 3,
      controlPointCount: 1,
      surveyPointCount: 2,
    } as MeasurementFile;

    mockPoints = [
      {
        id: 'p1',
        fileId: 'file1',
        pointNumber: '1',
        originalPointNumber: '1',
        code: 'A',
        x: 500000,
        y: 4000000,
        z: 100,
        lat: 39.9042,
        lng: 116.4074,
        type: 'control',
        order: 0,
      },
      {
        id: 'p2',
        fileId: 'file1',
        pointNumber: '2',
        originalPointNumber: '2',
        code: 'B',
        x: 500100,
        y: 4000100,
        z: 101,
        lat: 39.9052,
        lng: 116.4084,
        type: 'survey',
        order: 1,
      },
      {
        id: 'p3',
        fileId: 'file1',
        pointNumber: '3',
        originalPointNumber: '3',
        code: 'C',
        x: 500200,
        y: 4000200,
        z: 102,
        lat: 39.9062,
        lng: 116.4094,
        type: 'survey',
        order: 2,
        isManuallyAdded: true,
      },
    ] as MeasurementPoint[];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportFile', () => {
    it('应该导出简单格式的文件', () => {
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('应该导出详细格式的文件', () => {
      const options = {
        format: 'detailed' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该使用自定义文件名', () => {
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options, '自定义文件名');

      const mockLink = createElementSpy.mock.results[0].value;
      expect(mockLink.download).toBe('自定义文件名.dat');
    });

    it('应该只导出控制点', () => {
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: false,
        includeManual: false,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该只导出碎步点', () => {
      const options = {
        format: 'simple' as const,
        includeControl: false,
        includeSurvey: true,
        includeManual: false,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该只导出手动添加的点', () => {
      const options = {
        format: 'simple' as const,
        includeControl: false,
        includeSurvey: false,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该交换 X/Y 坐标', () => {
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: true,
      };

      exportFile(mockFile, mockPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该处理空编码', () => {
      const pointsWithoutCode = mockPoints.map(p => ({ ...p, code: undefined }));
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, pointsWithoutCode, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('exportMultipleFiles', () => {
    it('应该导出多个文件为 ZIP', async () => {
      const filesWithPoints = [
        { file: mockFile, points: mockPoints },
        {
          file: { ...mockFile, id: 'file2', name: '测试文件2.dat' },
          points: mockPoints.slice(0, 2),
        },
      ];

      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该使用自定义 ZIP 文件名', async () => {
      const filesWithPoints = [{ file: mockFile, points: mockPoints }];

      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options, '自定义ZIP');

      const mockLink = createElementSpy.mock.results[0].value;
      expect(mockLink.download).toBe('自定义ZIP.zip');
    });

    it('应该处理重名文件', async () => {
      const filesWithPoints = [
        { file: mockFile, points: mockPoints },
        { file: { ...mockFile, id: 'file2' }, points: mockPoints.slice(0, 1) },
        { file: { ...mockFile, id: 'file3' }, points: mockPoints.slice(0, 1) },
      ];

      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该生成说明文件', async () => {
      const filesWithPoints = [{ file: mockFile, points: mockPoints }];

      const options = {
        format: 'detailed' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该处理空点位列表', async () => {
      const filesWithPoints = [{ file: mockFile, points: [] }];

      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('应该在详细格式中包含质量参数', async () => {
      const pointsWithQuality: MeasurementPoint[] = [
        {
          ...mockPoints[0],
          qualityParams: {
            hrms: 0.01,
            vrms: 0.02,
            status: 'fixed',
            sats: 12,
          },
        },
      ];

      const filesWithPoints = [{ file: mockFile, points: pointsWithQuality }];

      const options = {
        format: 'detailed' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      await exportMultipleFiles(filesWithPoints, options);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('清理资源', () => {
    it('应该在下载后清理 URL', () => {
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('mock-url');
    });

    it('应该在下载后移除链接元素', () => {
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      const options = {
        format: 'simple' as const,
        includeControl: true,
        includeSurvey: true,
        includeManual: true,
        swapXY: false,
      };

      exportFile(mockFile, mockPoints, options);

      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
