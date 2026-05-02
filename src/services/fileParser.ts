import { v4 as uuidv4 } from 'uuid';
import type {
  MeasurementPoint,
  MeasurementFile,
  FileFormat,
  CoordinateSystem,
  ProjectionConfig,
} from '../types';
import { identifyPointType } from '../utils/pointType';
import { isValidCoordinate, sanitizePointNumber } from '../utils/sanitize';
import { appConfig } from '../config/appConfig';

// 解析错误
export interface ParseError {
  line: number;
  message: string;
  content: string;
}

// 解析警告
export interface ParseWarning {
  line: number;
  message: string;
  content?: string; // 原始行内容
  originalPointNumber?: string; // 原始点号
  duplicateFirstLine?: number; // 重复点号第一次出现的行号
}

// 解析结果
export interface ParseResult {
  points: MeasurementPoint[];
  format: FileFormat;
  errors: ParseError[];
  warnings: ParseWarning[];
}

// 文件解析器接口
export interface IFileParser {
  parse(file: File, fileId: string): Promise<ParseResult>;
  validate(content: string): boolean;
}

// .dat 文件解析器
export class DatFileParser implements IFileParser {
  async parse(file: File, fileId: string): Promise<ParseResult> {
    const content = await file.text();
    const lines = content.split(/\r?\n/).filter((line) => line.trim());

    const points: MeasurementPoint[] = [];
    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];
    const pointNumberSet = new Set<string>();
    const pointNumberFirstLine = new Map<string, number>(); // 记录点号第一次出现的行号
    let format: FileFormat = 'simple';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split(',');

        // 至少需要 5 个字段：点号,,X,Y,Z
        if (parts.length < 5) {
          errors.push({
            line: i + 1,
            message: '格式错误：字段数量不足',
            content: line,
          });
          continue;
        }

        let pointNumber = parts[0].trim();
        const x = parseFloat(parts[2]);
        const y = parseFloat(parts[3]);
        const z = parseFloat(parts[4]);

        // 验证坐标
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          errors.push({
            line: i + 1,
            message: '坐标值无效',
            content: line,
          });
          continue;
        }

        // 验证坐标范围
        if (!isValidCoordinate(x, y, z)) {
          warnings.push({
            line: i + 1,
            message: '坐标值超出合理范围，请检查坐标系统配置是否正确',
            content: line,
          });
        }

        // 处理点号唯一性
        let originalPointNumber = pointNumber; // 保存原始点号
        
        if (!pointNumber) {
          // 点号为空
          originalPointNumber = '未命名';
          pointNumber = `${originalPointNumber}_${uuidv4().slice(0, 8)}`;
          warnings.push({
            line: i + 1,
            message: `点号为空，已自动生成唯一标识：${pointNumber}`,
            content: line,
            originalPointNumber: originalPointNumber,
          });
        } else {
          // 清理点号中的非法字符
          const cleanedPointNumber = sanitizePointNumber(pointNumber);
          if (cleanedPointNumber !== pointNumber) {
            warnings.push({
              line: i + 1,
              message: `点号包含非法字符，已自动清理：${pointNumber} → ${cleanedPointNumber}`,
              content: line,
              originalPointNumber: pointNumber,
            });
            pointNumber = cleanedPointNumber;
          }
          
          // 检查点号重复
          if (pointNumberSet.has(pointNumber)) {
            const firstLine = pointNumberFirstLine.get(pointNumber);
            originalPointNumber = pointNumber;
            pointNumber = `${originalPointNumber}_${uuidv4().slice(0, 8)}`;
            warnings.push({
              line: i + 1,
              message: `点号 "${originalPointNumber}" 与第 ${firstLine} 行重复，已自动生成唯一标识：${pointNumber}`,
              content: line,
              originalPointNumber: originalPointNumber,
              duplicateFirstLine: firstLine,
            });
          } else {
            // 第一次出现，记录行号
            pointNumberFirstLine.set(pointNumber, i + 1);
          }
        }
        pointNumberSet.add(pointNumber);

        // 判断格式
        if (parts.length > 5) {
          format = 'detailed';
        }

        // 解析质量参数（详细格式）
        const qualityParams: Record<string, string | number> = {};
        if (parts.length > 5) {
          // 从第6个字段开始解析质量参数（KEY:VALUE格式）
          for (let j = 5; j < parts.length; j++) {
            const param = parts[j].trim();
            if (param) {
              // 解析 KEY:VALUE 格式
              const colonIndex = param.indexOf(':');
              if (colonIndex > 0) {
                const key = param.substring(0, colonIndex).toLowerCase();
                const valueStr = param.substring(colonIndex + 1);
                
                // 尝试将值转换为数字，如果失败则保持为字符串
                const numValue = parseFloat(valueStr);
                const value = !isNaN(numValue) ? numValue : valueStr;
                
                qualityParams[key] = value;
              }
            }
          }
        }

        const point: MeasurementPoint = {
          id: uuidv4(),
          fileId,
          pointNumber,
          originalPointNumber, // 保存原始点号
          x,
          y,
          z,
          type: identifyPointType(pointNumber),
          order: points.length, // 使用当前数组长度作为顺序号
          qualityParams: Object.keys(qualityParams).length > 0 ? qualityParams : undefined,
        };

        points.push(point);
      } catch (error) {
        errors.push({
          line: i + 1,
          message: `解析失败：${error instanceof Error ? error.message : '未知错误'}`,
          content: line,
        });
      }
    }

    return {
      points,
      format,
      errors,
      warnings,
    };
  }

  validate(content: string): boolean {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return false;

    // 检查至少有一行符合格式
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 5) {
        const x = parseFloat(parts[2]);
        const y = parseFloat(parts[3]);
        const z = parseFloat(parts[4]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          return true;
        }
      }
    }

    return false;
  }
}

// 创建测量文件对象
export function createMeasurementFile(
  fileName: string,
  parseResult: ParseResult,
  coordinateSystem: CoordinateSystem = 'CGCS2000',
  projectionConfig?: ProjectionConfig
): MeasurementFile {
  const { points, format } = parseResult;

  // 计算统计信息
  const controlPointCount = points.filter((p) => p.type === 'control').length;
  const surveyPointCount = points.filter((p) => p.type === 'survey').length;

  // 计算边界
  let bounds;
  if (points.length > 0) {
    bounds = {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
      minZ: Math.min(...points.map((p) => p.z)),
      maxZ: Math.max(...points.map((p) => p.z)),
    };
  }

  return {
    id: uuidv4(),
    name: fileName,
    uploadTime: Date.now(),
    format,
    coordinateSystem,
    pointCount: points.length,
    controlPointCount,
    surveyPointCount,
    projectionConfig: projectionConfig || {
      coordinateSystem,
      projectionType: appConfig.coordinate.defaultProjection as 'gauss-3',
      centralMeridian: appConfig.coordinate.defaultCentralMeridian,
    },
    bounds,
  };
}

// 导出默认解析器
export const fileParser = new DatFileParser();
