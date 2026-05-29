/**
 * 应用配置常量
 * 统一管理所有配置项，便于维护和修改
 * 
 * 注意：大部分配置已迁移到根目录的 app.config.json 文件
 * 这里保留的是不应该被用户修改的内部常量
 */

import { getAppConfig } from './appConfig';

// 文件上传配置（从 app.config.json 加载）
export const FILE_UPLOAD = {
  get MAX_SIZE_MB() {
    return getAppConfig().file.maxSizeMB;
  },
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
