import { coordinateConverter } from '../services/coordinateConverter';
import type { MeasurementFile } from '../types';

/**
 * 为指定文件转换 WGS84 坐标到投影坐标
 * @param lat 纬度
 * @param lng 经度
 * @param file 文件对象（包含投影配置）
 * @returns 投影坐标 { x, y }
 */
export function convertCoordinatesForFile(
  lat: number,
  lng: number,
  file: MeasurementFile
): { x: number; y: number } {
  return coordinateConverter.projectFromWGS84(
    lat,
    lng,
    file.projectionConfig.coordinateSystem,
    file.projectionConfig.projectionType,
    file.projectionConfig.centralMeridian
  );
}

/**
 * 为指定文件转换投影坐标到 WGS84 坐标
 * @param x X 坐标
 * @param y Y 坐标
 * @param file 文件对象（包含投影配置）
 * @returns WGS84 坐标 { lat, lng }
 */
export function convertCoordinatesToWGS84ForFile(
  x: number,
  y: number,
  file: MeasurementFile
): { lat: number; lng: number } {
  return coordinateConverter.projectToWGS84(
    x,
    y,
    file.projectionConfig.coordinateSystem,
    file.projectionConfig.projectionType,
    file.projectionConfig.centralMeridian
  );
}
