import proj4 from 'proj4';
import type { LatLng, XY, CoordinateSystem, ProjectionType } from '../types';
import { useSettingsStore } from '../store';

// 定义坐标系统（动态生成）
const COORDINATE_SYSTEMS: Record<string, string> = {
  WGS84: 'EPSG:4326',
};

export interface ICoordinateConverter {
  projectToWGS84(
    x: number,
    y: number,
    sourceSystem: CoordinateSystem,
    projectionType?: ProjectionType,
    centralMeridian?: number
  ): LatLng;
  projectFromWGS84(
    lat: number, 
    lng: number, 
    targetSystem: CoordinateSystem,
    projectionType?: ProjectionType,
    centralMeridian?: number
  ): XY;
  getSupportedSystems(): CoordinateSystem[];
  updateFromSettings(): void;
}

export class CoordinateConverter implements ICoordinateConverter {
  // 从设置存储中更新投影配置
  updateFromSettings() {
    const { centralMeridian, projectionType } = useSettingsStore.getState();
    this.updateProjections(centralMeridian, projectionType);
  }

  private updateProjections(centralMeridian: number, projectionType: ProjectionType) {
    // 根据投影类型确定假东偏移量
    // 3°带：500000m，6°带：500000m
    const falseEasting = 500000;

    // 更新投影定义
    COORDINATE_SYSTEMS.CGCS2000 = `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=1 +x_0=${falseEasting} +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs`;
    COORDINATE_SYSTEMS.Beijing54 = `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=1 +x_0=${falseEasting} +y_0=0 +ellps=krass +units=m +no_defs +type=crs`;
    COORDINATE_SYSTEMS.Xian80 = `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=1 +x_0=${falseEasting} +y_0=0 +a=6378140 +b=6356755.288157528 +units=m +no_defs +type=crs`;

    Object.entries(COORDINATE_SYSTEMS).forEach(([name, def]) => {
      if (name !== 'WGS84') {
        proj4.defs(name, def);
      }
    });

    console.log(`投影配置已更新: 中央经线=${centralMeridian}°, 投影类型=${projectionType}`);
  }

  projectToWGS84(
    x: number,
    y: number,
    sourceSystem: CoordinateSystem,
    projectionType?: ProjectionType,
    centralMeridian?: number
  ): LatLng {
    if (sourceSystem === 'WGS84') {
      return { lat: y, lng: x };
    }

    // 如果提供了投影参数，使用提供的参数；否则使用全局设置
    if (projectionType && centralMeridian) {
      // 临时更新投影配置
      this.updateProjections(centralMeridian, projectionType);
    } else {
      // 使用全局设置
      this.updateFromSettings();
    }

    try {
      // 注意：proj4 的输入顺序是 [东坐标, 北坐标]，即 [Y, X]
      const [lng, lat] = proj4(sourceSystem, 'WGS84', [y, x]);

      return { lat, lng };
    } catch (error) {
      console.error('坐标转换失败:', error);
      // 返回原始坐标作为经纬度（降级处理）
      return { lat: y, lng: x };
    }
  }

  projectFromWGS84(
    lat: number, 
    lng: number, 
    targetSystem: CoordinateSystem,
    projectionType?: ProjectionType,
    centralMeridian?: number
  ): XY {
    if (targetSystem === 'WGS84') {
      return { x: lng, y: lat };
    }

    // 如果提供了投影参数，使用提供的参数；否则使用全局设置
    if (projectionType && centralMeridian !== undefined) {
      // 临时更新投影配置以使用提供的参数
      this.updateProjections(centralMeridian, projectionType);
      
      try {
        const [y, x] = proj4('WGS84', targetSystem, [lng, lat]);
        return { x, y };
      } catch (error) {
        console.error('坐标转换失败:', error);
        // 返回原始坐标（降级处理）
        return { x: lng, y: lat };
      }
    }

    // 使用全局设置
    this.updateFromSettings();

    try {
      const [y, x] = proj4('WGS84', targetSystem, [lng, lat]);
      return { x, y };
    } catch (error) {
      console.error('坐标转换失败:', error);
      // 返回原始坐标（降级处理）
      return { x: lng, y: lat };
    }
  }

  getSupportedSystems(): CoordinateSystem[] {
    return ['CGCS2000', 'Beijing54', 'Xian80', 'WGS84'];
  }
}

// 导出默认实例
export const coordinateConverter = new CoordinateConverter();
