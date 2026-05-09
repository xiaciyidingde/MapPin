/**
 * 测量服务
 * 提供空间距离、平面距离和高差计算
 */

import type { MeasurementPoint } from '../types';

/**
 * 使用 Haversine 公式计算两个经纬度点之间的距离
 * @param lat1 第一个点的纬度
 * @param lng1 第一个点的经度
 * @param lat2 第二个点的纬度
 * @param lng2 第二个点的经度
 * @returns 距离（米）
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 检查点是否为虚拟点（当前位置或搜索标记）
 */
function isVirtualPoint(point: MeasurementPoint): boolean {
  return point.id === 'user-location' || point.id === 'search-marker';
}

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
  // 如果任一点是虚拟点，使用经纬度计算
  if (isVirtualPoint(point1) || isVirtualPoint(point2)) {
    if (point1.lat && point1.lng && point2.lat && point2.lng) {
      const planarDist = haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
      const dz = point2.z - point1.z;
      return Math.sqrt(planarDist * planarDist + dz * dz);
    }
  }
  
  // 否则使用投影坐标计算
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
  // 如果任一点是虚拟点，使用经纬度计算
  if (isVirtualPoint(point1) || isVirtualPoint(point2)) {
    if (point1.lat && point1.lng && point2.lat && point2.lng) {
      return haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
    }
  }
  
  // 否则使用投影坐标计算
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
