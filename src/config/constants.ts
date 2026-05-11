/**
 * 应用配置常量
 * 统一管理所有配置项，便于维护和修改
 * 
 * 注意：大部分配置已迁移到根目录的 app.config.json 文件
 * 这里保留的是不应该被用户修改的内部常量
 */

import { appConfig } from './appConfig';

// 文件上传配置（从 app.config.json 加载）
export const FILE_UPLOAD = {
  MAX_SIZE_MB: appConfig.file.maxSizeMB,
  ALLOWED_TYPES: appConfig.file.allowedTypes,
  ALLOWED_EXTENSIONS: appConfig.file.allowedExtensions,
} as const;

// 回收站配置（从 app.config.json 加载）
export const RECYCLE_BIN = {
  MAX_CAPACITY: appConfig.recycleBin.maxCapacity,
} as const;

// 坐标系统配置（从 app.config.json 加载）
export const COORDINATE_SYSTEM = {
  DEFAULT: appConfig.coordinate.defaultSystem as 'CGCS2000',
  DEFAULT_PROJECTION: appConfig.coordinate.defaultProjection as 'gauss-3',
  DEFAULT_CENTRAL_MERIDIAN: appConfig.coordinate.defaultCentralMeridian,
  CENTRAL_MERIDIAN_MIN: appConfig.coordinate.centralMeridianRange.min,
  CENTRAL_MERIDIAN_MAX: appConfig.coordinate.centralMeridianRange.max,
} as const;

// 坐标范围配置（用于验证）
export const COORDINATE_RANGE = {
  // X 坐标范围（米）
  X_MIN: -10000000,
  X_MAX: 10000000,
  // Y 坐标范围（米）
  Y_MIN: -10000000,
  Y_MAX: 10000000,
  // Z 坐标范围（米）
  Z_MIN: -1000,
  Z_MAX: 10000,
  // 经度范围
  LNG_MIN: -180,
  LNG_MAX: 180,
  // 纬度范围
  LAT_MIN: -90,
  LAT_MAX: 90,
} as const;

// 点号配置
export const POINT_NUMBER = {
  // 最大长度
  MAX_LENGTH: 50,
  // 允许的字符正则表达式
  VALID_PATTERN: /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/,
} as const;

// 文件名配置
export const FILE_NAME = {
  // 允许的字符正则表达式（允许中文、字母、数字、下划线、连字符、空格、括号）
  VALID_PATTERN: /^[\u4e00-\u9fa5a-zA-Z0-9_\-\s()（）]+$/,
} as const;

// 地图配置（从 app.config.json 加载）
export const MAP = {
  DEFAULT_CENTER: appConfig.map.defaultCenter as { lat: number; lng: number },
  DEFAULT_ZOOM: appConfig.map.defaultZoom,
  MIN_ZOOM: appConfig.map.minZoom,
  MAX_ZOOM: appConfig.map.maxZoom,
  CLUSTER: {
    RADIUS: appConfig.map.cluster.radius,
    MAX_ZOOM: appConfig.map.cluster.maxZoom,
  },
} as const;

// 性能配置（从 app.config.json 加载）
export const PERFORMANCE = {
  LARGE_FILE_THRESHOLD: appConfig.performance.largeFileThreshold,
  VIRTUAL_SCROLL_THRESHOLD: appConfig.performance.virtualScrollThreshold,
} as const;

// 导出配置（内部常量，不建议修改）
export const EXPORT = {
  DEFAULT_FORMAT: 'dat' as const,
  SUPPORTED_FORMATS: ['dat', 'csv'] as const,
} as const;

// 搜索配置（从 app.config.json 加载）
export const SEARCH = {
  DEBOUNCE_DELAY: appConfig.search.debounceDelay,
  MIN_LENGTH: appConfig.search.minLength,
} as const;

// 错误消息配置
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: `文件大小不能超过 ${FILE_UPLOAD.MAX_SIZE_MB}MB`,
  FILE_TYPE_INVALID: `只支持 ${FILE_UPLOAD.ALLOWED_EXTENSIONS} 格式文件`,
  FILE_NAME_EMPTY: '文件名不能为空',
  FILE_NAME_INVALID: '文件名包含非法字符',
  POINT_NUMBER_EMPTY: '点号不能为空',
  POINT_NUMBER_INVALID: '点号格式不正确，只允许字母、数字、中文、下划线和连字符',
  POINT_NUMBER_DUPLICATE: '点号已存在',
  COORDINATE_INVALID: '坐标值无效',
  COORDINATE_OUT_OF_RANGE: '坐标值超出合理范围',
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  UNKNOWN_ERROR: '操作失败，请重试',
} as const;

// 成功消息配置
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: '文件上传成功',
  FILE_DELETED: '文件已删除',
  FILE_RESTORED: '文件已恢复',
  POINT_UPDATED: '点位已更新',
  POINT_DELETED: '点位已删除',
  POINT_RESTORED: '点位已恢复',
  SETTINGS_SAVED: '设置已保存',
} as const;

