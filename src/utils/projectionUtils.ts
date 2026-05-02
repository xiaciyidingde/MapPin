/**
 * 根据经度和投影类型计算中央经线
 * @param lng 经度
 * @param projectionType 投影类型（'gauss-3' 或 'gauss-6'）
 * @returns 计算得到的中央经线（限制在 75°-135° 范围内）
 */
export function calculateCentralMeridian(
  lng: number,
  projectionType: 'gauss-3' | 'gauss-6'
): number {
  let calculatedMeridian: number;

  if (projectionType === 'gauss-3') {
    const zoneNumber = Math.round(lng / 3);
    calculatedMeridian = zoneNumber * 3;
  } else {
    const zoneNumber = Math.round((lng + 3) / 6);
    calculatedMeridian = zoneNumber * 6 - 3;
  }

  return Math.max(75, Math.min(135, calculatedMeridian));
}
