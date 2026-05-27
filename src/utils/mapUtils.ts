/**
 * 地图工具函数
 */

import type L from 'leaflet';
import type { MeasurementPoint } from '../types';

/**
 * 将地图缩放到显示所有点位
 * @param map Leaflet 地图实例
 * @param points 点位数组
 * @param options 缩放选项
 */
export function fitMapToPoints(
  map: L.Map,
  points: MeasurementPoint[],
  options?: { padding?: [number, number]; maxZoom?: number }
): void {
  const validPoints = points.filter((p) => p.lat && p.lng);
  if (validPoints.length > 0) {
    const bounds = validPoints.map((p) => [p.lat!, p.lng!] as [number, number]);
    map.fitBounds(bounds, {
      padding: options?.padding || [50, 50],
      maxZoom: options?.maxZoom || 24,
    });
  }
}

/**
 * 创建虚拟点（用于当前位置、搜索标记等）
 * @param id 点位 ID
 * @param name 点位名称
 * @param lat 纬度
 * @param lng 经度
 * @returns 虚拟点对象
 */
export function createVirtualPoint(
  id: string,
  name: string,
  lat: number,
  lng: number
): MeasurementPoint {
  return {
    id,
    fileId: 'virtual',
    pointNumber: name,
    originalPointNumber: name,
    x: lng, // 使用经度作为 x
    y: lat, // 使用纬度作为 y
    z: 0, // 高程设为 0
    lat,
    lng,
    type: 'survey',
    order: -1, // 虚拟顺序
  };
}
