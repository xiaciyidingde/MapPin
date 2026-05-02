/**
 * 测量服务
 * 提供空间距离、平面距离和高差计算
 */

import type { MeasurementPoint } from '../types';

/**
 * 计算两点之间的空间距离（考虑高程）
 * @param point1 第一个点
 * @param point2 第二个点
 * @returns 空间距离（米）
 */
export function calculateSpatialDistance(
  point1: MeasurementPoint,
  point2: MeasurementPoint
): number {
  // 计算平面距离
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  
  // 三维欧氏距离
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 计算两点之间的平面距离（不考虑高程）
 * @param point1 第一个点
 * @param point2 第二个点
 * @returns 平面距离（米）
 */
export function calculatePlanarDistance(
  point1: MeasurementPoint,
  point2: MeasurementPoint
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  
  // 二维欧氏距离
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算两点之间的高差
 * @param point1 第一个点
 * @param point2 第二个点
 * @returns 高差（米），正值表示 point2 高于 point1
 */
export function calculateElevationDifference(
  point1: MeasurementPoint,
  point2: MeasurementPoint
): number {
  return point2.z - point1.z;
}

/**
 * 格式化距离显示
 * @param distance 距离（米）
 * @returns 格式化后的字符串
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${(distance * 100).toFixed(2)} cm`;
  } else if (distance < 1000) {
    return `${distance.toFixed(3)} m`;
  } else {
    return `${(distance / 1000).toFixed(3)} km`;
  }
}

/**
 * 格式化高差显示
 * @param elevation 高差（米）
 * @returns 格式化后的字符串
 */
export function formatElevation(elevation: number): string {
  const sign = elevation >= 0 ? '+' : '';
  if (Math.abs(elevation) < 1) {
    return `${sign}${(elevation * 100).toFixed(2)} cm`;
  } else {
    return `${sign}${elevation.toFixed(3)} m`;
  }
}
