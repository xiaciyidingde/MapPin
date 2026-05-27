/**
 * 距离计算工具函数
 */

/**
 * 使用 Haversine 公式计算两个经纬度点之间的球面距离
 * @param p1 第一个点的经纬度坐标
 * @param p2 第二个点的经纬度坐标
 * @returns 距离（米）
 */
export function calculateHaversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) *
      Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 计算两点之间的平面距离（基于 x, y 坐标）
 * @param p1 第一个点的平面坐标
 * @param p2 第二个点的平面坐标
 * @returns 距离（单位与输入坐标单位相同）
 */
export function calculatePlaneDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
