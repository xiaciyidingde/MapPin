import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../store/useMapStore';

/**
 * 根据缩放级别自动选择合适的网格间距
 * 范围：1m - 500km
 */
function getGridIntervalForZoom(zoom: number): number {
  if (zoom >= 22) return 1; // 1m
  if (zoom >= 20) return 5; // 5m
  if (zoom >= 19) return 10; // 10m
  if (zoom >= 18) return 20; // 20m
  if (zoom >= 17) return 50; // 50m
  if (zoom >= 16) return 100; // 100m
  if (zoom >= 15) return 200; // 200m
  if (zoom >= 14) return 500; // 500m
  if (zoom >= 13) return 1000; // 1km
  if (zoom >= 12) return 2000; // 2km
  if (zoom >= 11) return 5000; // 5km
  if (zoom >= 10) return 10000; // 10km
  if (zoom >= 9) return 20000; // 20km
  if (zoom >= 8) return 50000; // 50km
  if (zoom >= 7) return 100000; // 100km
  if (zoom >= 6) return 200000; // 200km
  return 500000; // 500km
}

/**
 * 自定义网格图层类
 * 继承自 Leaflet 的 GridLayer，确保与地图完美同步
 */
class CustomGridLayer extends L.GridLayer {
  private gridInterval: number = 100;
  private onIntervalChange?: (interval: number) => void;
  private referenceLatitude: number = 0; // 用于计算经度间距的参考纬度
  private updateTimer: number | null = null; // 去抖定时器

  constructor(options?: L.GridLayerOptions & { onIntervalChange?: (interval: number) => void }) {
    super(options);
    this.onIntervalChange = options?.onIntervalChange;
  }

  onAdd(map: L.Map): this {
    // 记录地图中心纬度作为参考
    this.referenceLatitude = map.getCenter().lat;
    
    // 监听地图移动，更新参考纬度
    map.on('moveend', () => {
      const newLat = map.getCenter().lat;
      // 如果纬度变化超过一定阈值，更新参考纬度并重绘
      if (Math.abs(newLat - this.referenceLatitude) > 1) {
        this.referenceLatitude = newLat;
        this.redraw();
      }
    });

    return super.onAdd(map);
  }

  createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    const tileSize = this.getTileSize();
    tile.width = tileSize.x;
    tile.height = tileSize.y;

    const ctx = tile.getContext('2d');
    if (!ctx) return tile;

    // 获取当前缩放级别
    const zoom = coords.z;
    const currentGridInterval = getGridIntervalForZoom(zoom);
    
    // 只在间距变化时通知（使用去抖避免连续 setState）
    if (this.gridInterval !== currentGridInterval) {
      this.gridInterval = currentGridInterval;
      
      // 清除之前的定时器
      if (this.updateTimer !== null) {
        window.clearTimeout(this.updateTimer);
      }
      
      // 设置新的定时器，50ms 后触发更新
      this.updateTimer = window.setTimeout(() => {
        if (this.onIntervalChange) {
          this.onIntervalChange(currentGridInterval);
        }
        this.updateTimer = null;
      }, 50);
    }

    // 计算瓦片的地理边界
    const nwPoint = coords.scaleBy(tileSize);
    const sePoint = nwPoint.add(tileSize);
    
    const nw = this._map.unproject(nwPoint, zoom);
    const se = this._map.unproject(sePoint, zoom);

    // 计算网格间距（经纬度）
    const latDelta = currentGridInterval / 111000;
    // 使用固定的参考纬度计算经度间距，确保所有瓦片的经度间距一致
    const lngDelta = currentGridInterval / (111000 * Math.cos((this.referenceLatitude * Math.PI) / 180));

    // 用全局网格原点（0, 0），而不是瓦片边界，确保所有瓦片的网格线都对齐
    const minLat = Math.floor(se.lat / latDelta) * latDelta;
    const maxLat = Math.ceil(nw.lat / latDelta) * latDelta;
    const minLng = Math.floor(nw.lng / lngDelta) * lngDelta;
    const maxLng = Math.ceil(se.lng / lngDelta) * lngDelta;

    // 设置样式
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;

    ctx.beginPath();

    // 绘制纬线（横线）
    for (let lat = minLat; lat <= maxLat; lat += latDelta) {
      const startPoint = this._map.project(L.latLng(lat, nw.lng), zoom).subtract(nwPoint);
      const endPoint = this._map.project(L.latLng(lat, se.lng), zoom).subtract(nwPoint);
      
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
    }

    // 绘制经线（竖线）
    for (let lng = minLng; lng <= maxLng; lng += lngDelta) {
      const startPoint = this._map.project(L.latLng(nw.lat, lng), zoom).subtract(nwPoint);
      const endPoint = this._map.project(L.latLng(se.lat, lng), zoom).subtract(nwPoint);
      
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
    }

    ctx.stroke();

    return tile;
  }
}

export function GridLayer() {
  const map = useMap();
  const setGridInterval = useMapStore((state) => state.setGridInterval);

  useEffect(() => {
    if (!map) return;

    // 创建专用的网格图层 pane，确保在所有底图之上
    if (!map.getPane('gridPane')) {
      const gridPane = map.createPane('gridPane');
      gridPane.style.zIndex = '650'; // 高于 TilePane (200) 和 overlayPane (400)
    }

    // 创建自定义网格图层
    const gridLayer = new CustomGridLayer({
      tileSize: 512, // 减少瓦片数量
      opacity: 1,
      pane: 'gridPane', // 使用专用 pane
      onIntervalChange: (interval) => {
        setGridInterval(interval); // 同步到 store
      },
    });

    // 添加到地图
    gridLayer.addTo(map);

    // 清理函数
    return () => {
      map.removeLayer(gridLayer);
    };
  }, [map, setGridInterval]);

  // 不再单独渲染，由 LocationStatusIndicator 统一显示
  return null;
}
