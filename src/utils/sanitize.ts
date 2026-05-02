/**
 * 输入验证和清理工具
 * 防止 XSS 攻击和注入攻击
 */

import { 
  COORDINATE_RANGE, 
  POINT_NUMBER, 
  FILE_NAME, 
  FILE_UPLOAD 
} from '../config/constants';

/**
 * 清理 HTML 标签，防止 XSS
 */
export function sanitizeHTML(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * 验证文件名是否安全
 * 只允许字母、数字、中文、下划线、连字符和点
 */
export function isValidFileName(fileName: string): boolean {
  // 移除扩展名后检查
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // 不允许空文件名
  if (!nameWithoutExt || nameWithoutExt.trim().length === 0) {
    return false;
  }
  
  // 不允许路径遍历字符
  if (nameWithoutExt.includes('..') || nameWithoutExt.includes('/') || nameWithoutExt.includes('\\')) {
    return false;
  }
  
  // 只允许安全字符：字母、数字、中文、下划线、连字符、空格
  return FILE_NAME.VALID_PATTERN.test(nameWithoutExt);
}

/**
 * 清理文件名，移除不安全字符
 */
export function sanitizeFileName(fileName: string): string {
  // 保留扩展名
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  
  // 移除不安全字符，只保留安全字符
  const sanitized = name
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\-\s]/g, '_') // 替换不安全字符为下划线
    .replace(/\s+/g, '_') // 空格替换为下划线
    .replace(/_+/g, '_') // 多个下划线合并为一个
    .replace(/^_+|_+$/g, ''); // 移除首尾下划线
  
  return sanitized + ext;
}

/**
 * 验证点号是否安全
 * 点号应该是字母数字组合，不包含特殊字符
 */
export function isValidPointNumber(pointNumber: string): boolean {
  if (!pointNumber || pointNumber.trim().length === 0) {
    return false;
  }
  
  // 长度限制
  if (pointNumber.length > POINT_NUMBER.MAX_LENGTH) {
    return false;
  }
  
  // 只允许字母、数字、中文、下划线、连字符
  return POINT_NUMBER.VALID_PATTERN.test(pointNumber);
}

/**
 * 清理点号
 */
export function sanitizePointNumber(pointNumber: string): string {
  return pointNumber
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '') // 移除不安全字符
    .substring(0, POINT_NUMBER.MAX_LENGTH); // 限制长度
}

/**
 * 验证数字输入
 */
export function isValidNumber(value: unknown): boolean {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num);
  }
  
  return false;
}

/**
 * 验证坐标值是否在合理范围内
 */
export function isValidCoordinate(x: number, y: number, z: number): boolean {
  // X, Y 坐标范围（投影坐标，单位：米）
  const isXValid = isValidNumber(x) && 
    x >= COORDINATE_RANGE.X_MIN && 
    x <= COORDINATE_RANGE.X_MAX;
  const isYValid = isValidNumber(y) && 
    y >= COORDINATE_RANGE.Y_MIN && 
    y <= COORDINATE_RANGE.Y_MAX;
  
  // Z 坐标范围（高程，单位：米）
  const isZValid = isValidNumber(z) && 
    z >= COORDINATE_RANGE.Z_MIN && 
    z <= COORDINATE_RANGE.Z_MAX;
  
  return isXValid && isYValid && isZValid;
}

/**
 * 验证经纬度是否在合理范围内
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  const isLatValid = isValidNumber(lat) && 
    lat >= COORDINATE_RANGE.LAT_MIN && 
    lat <= COORDINATE_RANGE.LAT_MAX;
  const isLngValid = isValidNumber(lng) && 
    lng >= COORDINATE_RANGE.LNG_MIN && 
    lng <= COORDINATE_RANGE.LNG_MAX;
  
  return isLatValid && isLngValid;
}

/**
 * 限制字符串长度
 */
export function limitStringLength(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength);
}

/**
 * 验证文件大小
 */
export function isValidFileSize(size: number, maxSizeMB: number = FILE_UPLOAD.MAX_SIZE_MB): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size > 0 && size <= maxSizeBytes;
}

/**
 * 验证文件类型
 */
export function isValidFileType(fileName: string, allowedExtensions: string[]): boolean {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? allowedExtensions.includes(ext) : false;
}
