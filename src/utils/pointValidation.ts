import type { MeasurementPoint } from '../types';

/**
 * 验证点号是否重复
 * @param pointNumber 要验证的点号
 * @param currentPoints 当前文件的所有点位
 * @param excludeId 排除的点位 ID
 * @returns 验证结果
 */
export function validatePointNumber(
  pointNumber: string,
  currentPoints: MeasurementPoint[],
  excludeId?: string
): { valid: boolean; error?: string } {
  const existingPoint = currentPoints.find(
    p => p.pointNumber === pointNumber && p.id !== excludeId
  );
  
  if (existingPoint) {
    return { valid: false, error: `点号 ${pointNumber} 已存在` };
  }
  
  return { valid: true };
}
