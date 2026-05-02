/**
 * 地图瓦片源配置
 * 
 * 坐标系说明：
 * - WGS-84: 国际标准坐标系，GPS使用，Leaflet默认
 * - GCJ-02: 中国加密坐标系（火星坐标），高德、腾讯使用
 * - BD-09: 百度加密坐标系
 * 
 * 注意：本应用使用 WGS-84 坐标系，只选择兼容 WGS-84 的地图源
 */

import { appConfig } from './appConfig';

/**
 * 天地图默认 Token 池（固定分配 + 故障转移）
 */
const DEFAULT_TIANDITU_TOKENS = appConfig.map.tianDiTuTokens;

// Token 黑名单（会话期间有效，页面刷新后清空）
const tokenBlacklist = new Set<number>();

// 标记是否已经显示过警告（页面刷新后清空）
let hasShownWarning = false;

/**
 * 检查是否所有 Token 都已失败
 */
export function areAllTokensFailed(): boolean {
  return tokenBlacklist.size >= DEFAULT_TIANDITU_TOKENS.length;
}

/**
 * 检查是否已显示过警告
 */
export function hasShownTokenWarning(): boolean {
  return hasShownWarning;
}

/**
 * 标记已显示警告
 */
export function markWarningAsShown(): void {
  hasShownWarning = true;
}

/**
 * 获取或生成用户的固定 Token 索引
 * 基于 localStorage 存储，确保同一用户始终使用同一个 Token
 */
function getUserTokenIndex(): number {
  const STORAGE_KEY = 'mappin_token_index';
  
  // 如果没有公共 Token，返回 0
  if (!DEFAULT_TIANDITU_TOKENS || DEFAULT_TIANDITU_TOKENS.length === 0) {
    return 0;
  }
  
  // 尝试从 localStorage 获取已保存的索引
  const savedIndex = localStorage.getItem(STORAGE_KEY);
  
  if (savedIndex !== null) {
    const index = parseInt(savedIndex, 10);
    if (!isNaN(index) && index >= 0 && index < DEFAULT_TIANDITU_TOKENS.length) {
      return index;
    }
  }
  
  // 如果没有保存的索引，随机生成一个并保存
  const randomIndex = Math.floor(Math.random() * DEFAULT_TIANDITU_TOKENS.length);
  localStorage.setItem(STORAGE_KEY, randomIndex.toString());
  
  return randomIndex;
}

/**
 * 检查 Token 是否在黑名单中
 */
function isTokenBlacklisted(index: number): boolean {
  return tokenBlacklist.has(index);
}

/**
 * 获取下一个可用的 Token 索引（跳过黑名单）
 */
function getNextAvailableTokenIndex(currentIndex: number): number {
  for (let i = 1; i <= DEFAULT_TIANDITU_TOKENS.length; i++) {
    const nextIndex = (currentIndex + i) % DEFAULT_TIANDITU_TOKENS.length;
    if (!isTokenBlacklisted(nextIndex)) {
      return nextIndex;
    }
  }
  
  // 如果所有 Token 都在黑名单中，返回当前索引（没有更好的选择）
  console.warn('所有默认 Token 都已失败，建议申请个人 Token');
  return currentIndex;
}

/**
 * 切换到下一个可用的 Token
 * 当前 Token 失败时调用此函数
 * @returns 是否成功切换到新 Token（false 表示所有 Token 都已失败）
 */
export function switchToNextToken(): boolean {
  const STORAGE_KEY = 'mappin_token_index';
  const currentIndex = getUserTokenIndex();
  
  // 将当前 Token 加入黑名单（会话期间有效）
  tokenBlacklist.add(currentIndex);
  
  // 检查是否所有 Token 都已失败
  if (areAllTokensFailed()) {
    console.error('所有默认 Token 都已失败，请申请个人 Token');
    return false;
  }
  
  // 获取下一个可用的 Token
  const nextIndex = getNextAvailableTokenIndex(currentIndex);
  
  // 保存新的索引
  localStorage.setItem(STORAGE_KEY, nextIndex.toString());
  
  console.log(`Token 已切换：分流${currentIndex + 1} → 分流${nextIndex + 1}`);
  return true;
}

/**
 * 获取天地图 Token（固定分配 + 故障转移策略）
 * @param userToken 用户自定义的 Token
 * @returns 返回用户 Token 或默认 Token
 */
export function getTiandituToken(userToken?: string): string {
  // 如果用户提供了自己的 Token，优先使用
  if (userToken && userToken.trim()) {
    return userToken.trim();
  }
  
  // 检查是否有公共 Token 池
  if (!DEFAULT_TIANDITU_TOKENS || DEFAULT_TIANDITU_TOKENS.length === 0) {
    console.warn('未配置公共天地图 Token，请在应用设置中配置您的个人 Token');
    return ''; // 返回空字符串，地图将无法加载
  }
  
  // 获取用户的固定 Token 索引
  let tokenIndex = getUserTokenIndex();
  
  // 如果当前 Token 在黑名单中，切换到下一个可用的
  if (isTokenBlacklisted(tokenIndex)) {
    tokenIndex = getNextAvailableTokenIndex(tokenIndex);
    localStorage.setItem('mappin_token_index', tokenIndex.toString());
  }
  
  return DEFAULT_TIANDITU_TOKENS[tokenIndex];
}

export interface MapTileSource {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom: number;
  subdomains?: string[];
  requiresToken?: boolean;
  tokenParam?: string;
  coordinateSystem: 'WGS-84' | 'GCJ-02' | 'BD-09';
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  annotationLayer?: string; // 标注图层 URL（用于天地图等需要叠加标注的地图）
}

export const MAP_TILE_SOURCES: Record<string, MapTileSource> = {
  'osm': {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 25,
    maxNativeZoom: 19,
    subdomains: ['a', 'b', 'c'],
    coordinateSystem: 'WGS-84',
    description: '国际标准地图，数据详细，国内可能无法访问',
    speed: 'slow',
  },
  
  'tianditu-vec': {
    id: 'tianditu-vec',
    name: '天地图-矢量',
    url: 'https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk={token}',
    annotationLayer: 'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk={token}',
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',
    maxZoom: 25,
    maxNativeZoom: 18,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    requiresToken: true,
    tokenParam: 'tk',
    coordinateSystem: 'WGS-84',
    description: '国家地理信息公共服务平台-矢量图',
    speed: 'fast',
  },
  
  'tianditu-img': {
    id: 'tianditu-img',
    name: '天地图-影像',
    url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk={token}',
    annotationLayer: 'https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk={token}',
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',
    maxZoom: 25,
    maxNativeZoom: 18,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    requiresToken: true,
    tokenParam: 'tk',
    coordinateSystem: 'WGS-84',
    description: '国家地理信息公共服务平台-卫星影像地图',
    speed: 'fast',
  },
  
  'tianditu-ter': {
    id: 'tianditu-ter',
    name: '天地图-地形',
    url: 'https://t{s}.tianditu.gov.cn/DataServer?T=ter_w&x={x}&y={y}&l={z}&tk={token}',
    annotationLayer: 'https://t{s}.tianditu.gov.cn/DataServer?T=cta_w&x={x}&y={y}&l={z}&tk={token}',
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',
    maxZoom: 25,
    maxNativeZoom: 14,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    requiresToken: true,
    tokenParam: 'tk',
    coordinateSystem: 'WGS-84',
    description: '国家地理信息公共服务平台-地形晕渲图',
    speed: 'fast',
  },
};

/**
 * 获取地图瓦片 URL
 * @param sourceId 地图源 ID
 * @param token 可选的 API token
 * @returns 完整的瓦片 URL
 */
export function getMapTileUrl(sourceId: string, token?: string): string {
  const source = MAP_TILE_SOURCES[sourceId];
  if (!source) {
    return MAP_TILE_SOURCES['osm'].url;
  }
  
  // 如果需要 token，使用轮询策略获取
  if (source.requiresToken) {
    const actualToken = getTiandituToken(token);
    return source.url.replace('{token}', actualToken);
  }
  
  return source.url;
}

/**
 * 获取标注图层 URL
 * @param sourceId 地图源 ID
 * @param token 可选的 API token
 * @returns 标注图层 URL，如果没有则返回 undefined
 */
export function getAnnotationLayerUrl(sourceId: string, token?: string): string | undefined {
  const source = MAP_TILE_SOURCES[sourceId];
  if (!source || !source.annotationLayer) {
    return undefined;
  }
  
  // 如果需要 token，使用轮询策略获取
  if (source.requiresToken) {
    const actualToken = getTiandituToken(token);
    return source.annotationLayer.replace('{token}', actualToken);
  }
  
  return source.annotationLayer;
}

/**
 * 获取地图源列表（用于设置界面）
 */
export function getMapTileSourceList(): MapTileSource[] {
  return Object.values(MAP_TILE_SOURCES);
}
