/**
 * 集成测试辅助函数
 */

import { readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileParser, createMeasurementFile } from '../../services/fileParser';
import { dataService } from '../../services/dataService';
import type { MeasurementFile, MeasurementPoint, CoordinateSystem, ProjectionType } from '../../types';

// 测试数据目录
const TEST_DATA_DIR = join(__dirname, '../test_data');
const OUTPUT_DIR = join(__dirname, '../output');

/**
 * 测试文件路径
 */
export const TEST_FILES = {
  small: join(TEST_DATA_DIR, 'test_50points.dat'),
  large: join(TEST_DATA_DIR, 'test_2000points_dist10_20260428_083301.dat'),
  merge: join(TEST_DATA_DIR, 'test_merge_100points.dat'),
};

/**
 * 输出目录
 */
export const OUTPUT_PATH = OUTPUT_DIR;

/**
 * 创建测试文件并保存到数据库
 */
export async function createTestFile(
  testFilePath: string,
  fileName: string,
  options: {
    pointCount?: number;
    coordinateSystem?: CoordinateSystem;
    projectionType?: ProjectionType;
    centralMeridian?: number;
  } = {}
): Promise<{ fileId: string; file: MeasurementFile; points: MeasurementPoint[] }> {
  const {
    pointCount,
    coordinateSystem = 'CGCS2000',
    projectionType = 'gauss-3',
    centralMeridian = 117,
  } = options;

  // 读取测试文件
  const fileContent = readFileSync(testFilePath, 'utf-8');
  const blob = new Blob([fileContent], { type: 'text/plain' });
  const file = new File([blob], fileName, { type: 'text/plain' });

  // 解析文件
  const tempFileId = 'temp-file-id';
  const parseResult = await fileParser.parse(file, tempFileId);

  // 限制点位数量（如果指定）
  const points = pointCount
    ? parseResult.points.slice(0, pointCount)
    : parseResult.points;

  // 创建文件记录
  const measurementFile = createMeasurementFile(
    fileName,
    { ...parseResult, points },
    coordinateSystem,
    {
      coordinateSystem,
      projectionType,
      centralMeridian,
    }
  );

  // 保存到数据库
  const fileId = await dataService.saveFile(measurementFile);

  // 保存点位
  const pointsWithFileId = points.map(p => ({
    ...p,
    fileId,
  }));
  await dataService.savePoints(pointsWithFileId);

  return { fileId, file: measurementFile, points: pointsWithFileId };
}

/**
 * 清理数据库
 */
export async function cleanDatabase(): Promise<void> {
  const files = await dataService.getAllFiles();
  for (const file of files) {
    await dataService.deleteFile(file.id);
  }
  await dataService.clearRecycleBin();
}

/**
 * 清理输出目录中的临时文件
 */
export function cleanOutputDirectory(): void {
  try {
    const files = readdirSync(OUTPUT_DIR);
    for (const file of files) {
      if (file !== '.gitignore') {
        unlinkSync(join(OUTPUT_DIR, file));
      }
    }
  } catch {
    // 忽略清理错误
  }
}

/**
 * 验证点位数据完整性
 */
export function validatePointData(point: MeasurementPoint): void {
  if (!point.id) throw new Error('点位缺少 id');
  if (!point.fileId) throw new Error('点位缺少 fileId');
  if (!point.pointNumber) throw new Error('点位缺少 pointNumber');
  if (typeof point.x !== 'number') throw new Error('点位 x 坐标无效');
  if (typeof point.y !== 'number') throw new Error('点位 y 坐标无效');
  if (typeof point.z !== 'number') throw new Error('点位 z 坐标无效');
  if (!['control', 'survey'].includes(point.type)) throw new Error('点位类型无效');
}

/**
 * 验证文件数据完整性
 */
export function validateFileData(file: MeasurementFile): void {
  if (!file.id) throw new Error('文件缺少 id');
  if (!file.name) throw new Error('文件缺少 name');
  if (!file.coordinateSystem) throw new Error('文件缺少 coordinateSystem');
  if (!file.projectionConfig) throw new Error('文件缺少 projectionConfig');
  if (typeof file.pointCount !== 'number') throw new Error('文件 pointCount 无效');
}

/**
 * 生成导出内容（用于测试，不触发下载）
 */
export function generateExportContent(
  points: MeasurementPoint[],
  format: 'simple' | 'detailed',
  swapXY: boolean = false
): string {
  const lines: string[] = [];

  for (const point of points) {
    if (format === 'detailed') {
      lines.push(formatDetailedLine(point, swapXY));
    } else {
      lines.push(formatSimpleLine(point, swapXY));
    }
  }

  return lines.join('\n');
}

function formatSimpleLine(point: MeasurementPoint, swapXY: boolean): string {
  const x = swapXY ? point.y : point.x;
  const y = swapXY ? point.x : point.y;
  return `${point.pointNumber},${point.code || ''},${x},${y},${point.z}`;
}

function formatDetailedLine(point: MeasurementPoint, swapXY: boolean): string {
  const x = swapXY ? point.y : point.x;
  const y = swapXY ? point.x : point.y;
  
  const parts = [
    point.pointNumber,
    point.code || '',
    x.toString(),
    y.toString(),
    point.z.toString(),
    point.type === 'control' ? '控制点' : '碎步点',
  ];

  if (point.lat !== undefined && point.lng !== undefined) {
    parts.push(point.lat.toFixed(8));
    parts.push(point.lng.toFixed(8));
  }

  return parts.join(',');
}
