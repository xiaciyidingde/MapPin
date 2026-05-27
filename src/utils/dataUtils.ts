import { useDataStore } from '../store/useDataStore';
import type { MeasurementPoint } from '../types';

/**
 * 加载并获取文件的点位数据
 * @param fileId 文件 ID
 * @param loadPoints 加载点位的函数
 * @returns 点位数组
 */
export async function loadAndGetPoints(
  fileId: string,
  loadPoints: (id: string) => Promise<void>
): Promise<MeasurementPoint[]> {
  await loadPoints(fileId);
  return useDataStore.getState().points.get(fileId) || [];
}

/**
 * 批量加载并获取多个文件的点位数据
 * @param fileIds 文件 ID 数组
 * @param loadPoints 加载点位的函数
 * @returns 文件 ID 到点位数组的映射
 */
export async function loadAndGetMultiplePoints(
  fileIds: string[],
  loadPoints: (id: string) => Promise<void>
): Promise<Map<string, MeasurementPoint[]>> {
  const result = new Map<string, MeasurementPoint[]>();
  
  for (const fileId of fileIds) {
    const points = await loadAndGetPoints(fileId, loadPoints);
    result.set(fileId, points);
  }
  
  return result;
}
