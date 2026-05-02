import { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * 节流函数：限制函数执行频率
 */
function throttle<T extends (...args: never[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // 清除之前的延迟调用
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (timeSinceLastCall >= delay) {
      // 如果距离上次调用已经超过延迟时间，立即执行
      lastCall = now;
      func(...args);
    } else {
      // 否则延迟执行，确保最后一次调用会被执行
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * 根据缩放级别自动选择合适的网格间距
 * 范围：5m - 100km
 */
function getGridIntervalForZoom(zoom: number): number {
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
  return 100000; // 100km
}

/**
 * 将米转换为经纬度差值（近似）
 */
function metersToLatLng(meters: number, lat: number): { latDelta: number; lngDelta: number } {
  const latDelta = meters / 111000;
  const lngDelta = meters / (111000 * Math.cos((lat * Math.PI) / 180));
  return { latDelta, lngDelta };
}

export function GridLayer() {
  const map = useMap();
  const [gridInterval, setGridInterval] = useState(100);
  const drawGridRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map) return;

    // 创建 SVG 覆盖层
    const svg = L.svg({ padding: 0.5 });
    svg.addTo(map);

    const drawGrid = () => {
      // 获取 SVG 容器
      const container = map.getPanes().overlayPane;
      if (!container) return;

      // 清除旧的网格
      const oldGrid = container.querySelector('.grid-lines');
      if (oldGrid) {
        oldGrid.remove();
      }

      // 创建新的 SVG group
      const svgElement = container.querySelector('svg');
      if (!svgElement) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'grid-lines');

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const currentGridInterval = getGridIntervalForZoom(zoom);
      setGridInterval(currentGridInterval);
      
      const center = map.getCenter();
      const { latDelta, lngDelta } = metersToLatLng(currentGridInterval, center.lat);

      // 计算网格范围
      const minLat = Math.floor(bounds.getSouth() / latDelta) * latDelta;
      const maxLat = Math.ceil(bounds.getNorth() / latDelta) * latDelta;
      const minLng = Math.floor(bounds.getWest() / lngDelta) * lngDelta;
      const maxLng = Math.ceil(bounds.getEast() / lngDelta) * lngDelta;

      // 绘制纬线（横线）
      for (let lat = minLat; lat <= maxLat; lat += latDelta) {
        const startPoint = map.latLngToLayerPoint([lat, bounds.getWest()]);
        const endPoint = map.latLngToLayerPoint([lat, bounds.getEast()]);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startPoint.x.toString());
        line.setAttribute('y1', startPoint.y.toString());
        line.setAttribute('x2', endPoint.x.toString());
        line.setAttribute('y2', endPoint.y.toString());
        line.setAttribute('stroke', '#888888');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.6');
        g.appendChild(line);
      }

      // 绘制经线（竖线）
      for (let lng = minLng; lng <= maxLng; lng += lngDelta) {
        const startPoint = map.latLngToLayerPoint([bounds.getSouth(), lng]);
        const endPoint = map.latLngToLayerPoint([bounds.getNorth(), lng]);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startPoint.x.toString());
        line.setAttribute('y1', startPoint.y.toString());
        line.setAttribute('x2', endPoint.x.toString());
        line.setAttribute('y2', endPoint.y.toString());
        line.setAttribute('stroke', '#888888');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.6');
        g.appendChild(line);
      }

      svgElement.appendChild(g);
    };

    // 保存 drawGrid 引用供节流函数使用
    drawGridRef.current = drawGrid;

    // 创建节流版本的 drawGrid（50ms 间隔，每秒约 20 次更新）
    const throttledDrawGrid = throttle(drawGrid, 50);

    // 初始绘制
    drawGrid();

    // 监听地图事件
    // move: 移动过程中触发（节流）
    // moveend, zoomend, viewreset: 移动/缩放结束后立即更新
    map.on('move', throttledDrawGrid);
    map.on('moveend zoomend viewreset', drawGrid);

    // 清理函数
    return () => {
      map.off('move', throttledDrawGrid);
      map.off('moveend zoomend viewreset', drawGrid);
      const container = map.getPanes().overlayPane;
      if (container) {
        const oldGrid = container.querySelector('.grid-lines');
        if (oldGrid) {
          oldGrid.remove();
        }
      }
    };
  }, [map]);

  // 渲染网格间距显示
  const intervalText = gridInterval >= 1000 
    ? `${(gridInterval / 1000).toFixed(1)}km` 
    : `${gridInterval}m`;

  return (
    <div
      style={{
        position: 'absolute',
        top: '32px',
        right: '10px',
        zIndex: 1000,
        fontSize: '14px',
        fontWeight: 500,
        color: '#595959',
        textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white',
        pointerEvents: 'none',
      }}
    >
      网格间距: {intervalText}
    </div>
  );
}
