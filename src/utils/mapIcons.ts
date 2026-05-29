import L from 'leaflet';
import { appConfig } from '../config/appConfig';

// 图标缓存
const iconCache = new Map<string, L.DivIcon>();
const MAX_CACHE_SIZE = appConfig.performance.iconCacheSize;

// 清除缓存的函数
export function clearIconCache() {
  iconCache.clear();
}

// 生成缓存键
function getCacheKey(type: string, pointNumber?: string, code?: string, showLabel?: boolean): string {
  return `${type}-${pointNumber || ''}-${code || ''}-${showLabel || false}`;
}

// 创建带标签的蓝色圆点图标（测量点）
export function createSurveyPointIcon(pointNumber?: string, code?: string, showLabel: boolean = false) {
  const cacheKey = getCacheKey('survey', pointNumber, code, showLabel);
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  const icon = L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div class="marker-with-label">
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="#1677ff" stroke="white" stroke-width="2"/>
        </svg>
        ${showLabel && pointNumber ? `
          <div class="marker-label">
            <div class="marker-label-number">${pointNumber}</div>
            ${code ? `<div class="marker-label-code">${code}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
  
  if (iconCache.size < MAX_CACHE_SIZE) {
    iconCache.set(cacheKey, icon);
  }
  
  return icon;
}

// 创建带标签的红色三角形图标（控制点）
export function createControlPointIcon(pointNumber?: string, code?: string, showLabel: boolean = false) {
  const cacheKey = getCacheKey('control', pointNumber, code, showLabel);
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  const icon = L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div class="marker-with-label">
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4 L20 20 L4 20 Z" fill="#cf1322" stroke="white" stroke-width="2"/>
        </svg>
        ${showLabel && pointNumber ? `
          <div class="marker-label">
            <div class="marker-label-number">${pointNumber}</div>
            ${code ? `<div class="marker-label-code">${code}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 20],
    popupAnchor: [0, -20],
  });
  
  if (iconCache.size < MAX_CACHE_SIZE) {
    iconCache.set(cacheKey, icon);
  }
  
  return icon;
}

// 创建带标签的红色圆点图标（测量模式选中的点）
export function createSelectedPointIcon(pointNumber?: string, code?: string, showLabel: boolean = false) {
  const cacheKey = getCacheKey('selected', pointNumber, code, showLabel);
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  const icon = L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div class="marker-with-label">
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="#ff4d4f" stroke="white" stroke-width="2"/>
        </svg>
        ${showLabel && pointNumber ? `
          <div class="marker-label">
            <div class="marker-label-number">${pointNumber}</div>
            ${code ? `<div class="marker-label-code">${code}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
  
  if (iconCache.size < MAX_CACHE_SIZE) {
    iconCache.set(cacheKey, icon);
  }
  
  return icon;
}

// 兼容旧代码的静态图标（不带标签）
export const surveyPointIcon = createSurveyPointIcon();
export const controlPointIcon = createControlPointIcon();
export const selectedPointIcon = createSelectedPointIcon();

// 根据点类型获取图标
export function getMarkerIcon(type: 'control' | 'survey', pointNumber?: string, code?: string, showLabel: boolean = false) {
  if (type === 'control') {
    return createControlPointIcon(pointNumber, code, showLabel);
  }
  return createSurveyPointIcon(pointNumber, code, showLabel);
}

// 创建用户位置图标（导航风格，带方向箭头）
export function createUserLocationIcon(heading: number = 0) {
  return L.divIcon({
    className: 'custom-marker-icon user-location-icon',
    html: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <!-- 旋转组：圆圈和箭头作为一个整体 -->
        <g transform="rotate(${heading} 16 16)">
          <!-- 主圆圈 -->
          <circle cx="16" cy="16" r="9" fill="#1890ff" stroke="white" stroke-width="2.5"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
          
          <!-- 方向三角形箭头（更大更明显） -->
          <path d="M16 1 L23 9 L16 6 L9 9 Z" 
                fill="white" 
                stroke="white" 
                stroke-width="0.5"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>
        </g>
      </svg>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// 创建选中状态的用户位置图标（红色，带方向箭头）
export function createSelectedUserLocationIcon(heading: number = 0) {
  return L.divIcon({
    className: 'custom-marker-icon user-location-icon',
    html: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <!-- 旋转组：圆圈和箭头作为一个整体 -->
        <g transform="rotate(${heading} 16 16)">
          <!-- 主圆圈 -->
          <circle cx="16" cy="16" r="9" fill="#ff4d4f" stroke="white" stroke-width="2.5"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
          
          <!-- 方向三角形箭头（更大更明显） -->
          <path d="M16 1 L23 9 L16 6 L9 9 Z" 
                fill="white" 
                stroke="white" 
                stroke-width="0.5"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>
        </g>
      </svg>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// 兼容旧代码：默认向上的用户位置图标
export const userLocationIcon = createUserLocationIcon(0);
export const selectedUserLocationIcon = createSelectedUserLocationIcon(0);

// 创建搜索标记图标（橙色）
export const searchMarkerIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <!-- 阴影 -->
      <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.25)"/>
      <!-- 定位针（水滴形状） -->
      <path d="M16 2 C9 2 3 8 3 15 C3 22 16 38 16 38 C16 38 29 22 29 15 C29 8 23 2 16 2 Z" 
            fill="#fa8c16" 
            stroke="white" 
            stroke-width="2"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <!-- 中心圆点 -->
      <circle cx="16" cy="15" r="4" fill="white"/>
    </svg>
  `,
  iconSize: [32, 42],
  iconAnchor: [16, 38],
  popupAnchor: [0, -38],
});

// 创建选中状态的搜索标记图标（红色）
export const selectedSearchMarkerIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <!-- 阴影 -->
      <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.25)"/>
      <!-- 定位针（水滴形状） -->
      <path d="M16 2 C9 2 3 8 3 15 C3 22 16 38 16 38 C16 38 29 22 29 15 C29 8 23 2 16 2 Z" 
            fill="#ff4d4f" 
            stroke="white" 
            stroke-width="2"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <!-- 中心圆点 -->
      <circle cx="16" cy="15" r="4" fill="white"/>
    </svg>
  `,
  iconSize: [32, 42],
  iconAnchor: [16, 38],
  popupAnchor: [0, -38],
});
