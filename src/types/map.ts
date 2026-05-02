// 经纬度坐标
export interface LatLng {
  lat: number;
  lng: number;
}

// 平面坐标
export interface XY {
  x: number;
  y: number;
}

// 地图底图类型
export type BaseMapType = 'osm' | 'tianditu' | 'amap';

// 地图边界
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
