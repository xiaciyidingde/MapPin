import L from 'leaflet';

// 创建蓝色圆点图标（测量点）
export const surveyPointIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#1677ff" stroke="white" stroke-width="2"/>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// 创建红色三角形图标（控制点）
export const controlPointIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4 L20 20 L4 20 Z" fill="#cf1322" stroke="white" stroke-width="2"/>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 20],
  popupAnchor: [0, -20],
});

// 创建红色圆点图标（测量模式选中的点）
export const selectedPointIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#ff4d4f" stroke="white" stroke-width="2"/>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// 根据点类型获取图标
export function getMarkerIcon(type: 'control' | 'survey') {
  return type === 'control' ? controlPointIcon : surveyPointIcon;
}

// 创建用户位置图标（导航软件风格的定位图标）
export const userLocationIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
      <!-- 阴影 -->
      <ellipse cx="18" cy="46" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>
      <!-- 外圈脉冲效果 -->
      <circle cx="18" cy="18" r="16" fill="#1890ff" opacity="0.15">
        <animate attributeName="r" from="12" to="18" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <!-- 主定位图标（水滴形状） -->
      <path d="M18 2 C10 2 4 8 4 16 C4 24 18 42 18 42 C18 42 32 24 32 16 C32 8 26 2 18 2 Z" 
            fill="#1890ff" 
            stroke="white" 
            stroke-width="2.5"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <!-- 中心圆点 -->
      <circle cx="18" cy="16" r="5" fill="white"/>
    </svg>
  `,
  iconSize: [36, 48],
  iconAnchor: [18, 42],
  popupAnchor: [0, -42],
});

// 创建选中状态的用户位置图标（红色）
export const selectedUserLocationIcon = L.divIcon({
  className: 'custom-marker-icon',
  html: `
    <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
      <!-- 阴影 -->
      <ellipse cx="18" cy="46" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>
      <!-- 外圈脉冲效果 -->
      <circle cx="18" cy="18" r="16" fill="#ff4d4f" opacity="0.15">
        <animate attributeName="r" from="12" to="18" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <!-- 主定位图标（水滴形状） -->
      <path d="M18 2 C10 2 4 8 4 16 C4 24 18 42 18 42 C18 42 32 24 32 16 C32 8 26 2 18 2 Z" 
            fill="#ff4d4f" 
            stroke="white" 
            stroke-width="2.5"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <!-- 中心圆点 -->
      <circle cx="18" cy="16" r="5" fill="white"/>
    </svg>
  `,
  iconSize: [36, 48],
  iconAnchor: [18, 42],
  popupAnchor: [0, -42],
});
