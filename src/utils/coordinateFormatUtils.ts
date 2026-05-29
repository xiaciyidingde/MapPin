/**
 * 坐标格式转换工具
 * 支持多种坐标格式之间的相互转换
 */

export type CoordinateFormat = 'dd' | 'dm' | 'dms' | 'xy';

/**
 * 十进制度转度分秒
 * @param decimal 十进制度数
 * @param isLat 是否为纬度（用于确定方向）
 * @returns 度分秒对象
 */
export function decimalToDMS(decimal: number, isLat: boolean): { degrees: number; minutes: number; seconds: number; direction: string } {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  
  let direction: string;
  if (isLat) {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }
  
  return { degrees, minutes, seconds, direction };
}

/**
 * 度分秒转十进制度
 * @param degrees 度
 * @param minutes 分
 * @param seconds 秒
 * @param direction 方向 (N/S/E/W)
 * @returns 十进制度数
 */
export function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

/**
 * 十进制度转度分
 * @param decimal 十进制度数
 * @param isLat 是否为纬度
 * @returns 度分对象
 */
export function decimalToDM(decimal: number, isLat: boolean): { degrees: number; minutes: number; direction: string } {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60;
  
  let direction: string;
  if (isLat) {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }
  
  return { degrees, minutes, direction };
}

/**
 * 度分转十进制度
 * @param degrees 度
 * @param minutes 分
 * @param direction 方向 (N/S/E/W)
 * @returns 十进制度数
 */
export function dmToDecimal(degrees: number, minutes: number, direction: string): number {
  let decimal = degrees + minutes / 60;
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

/**
 * 格式化度分秒为字符串
 * @param dms 度分秒对象
 * @returns 格式化字符串，如 "39°54'23.36\"N"
 */
export function formatDMS(dms: { degrees: number; minutes: number; seconds: number; direction: string }): string {
  return `${dms.degrees}°${dms.minutes}'${dms.seconds.toFixed(2)}"${dms.direction}`;
}

/**
 * 格式化度分为字符串
 * @param dm 度分对象
 * @returns 格式化字符串，如 "39°54.389'N"
 */
export function formatDM(dm: { degrees: number; minutes: number; direction: string }): string {
  return `${dm.degrees}°${dm.minutes.toFixed(3)}'${dm.direction}`;
}

/**
 * 解析度分秒字符串
 * @param dmsStr 度分秒字符串，如 "39°54'23.36\"N" 或 "39 54 23.36 N"
 * @returns 度分秒对象，解析失败返回 null
 */
export function parseDMS(dmsStr: string): { degrees: number; minutes: number; seconds: number; direction: string } | null {
  // 支持多种格式：39°54'23.36"N, 39 54 23.36 N, 39d54m23.36sN
  const patterns = [
    /^(\d+)[°d]\s*(\d+)[''′m]\s*([\d.]+)["″s]?\s*([NSEW])$/i,
    /^(\d+)\s+(\d+)\s+([\d.]+)\s+([NSEW])$/i,
  ];
  
  for (const pattern of patterns) {
    const match = dmsStr.trim().match(pattern);
    if (match) {
      return {
        degrees: parseInt(match[1]),
        minutes: parseInt(match[2]),
        seconds: parseFloat(match[3]),
        direction: match[4].toUpperCase(),
      };
    }
  }
  
  return null;
}

/**
 * 解析度分字符串
 * @param dmStr 度分字符串，如 "39°54.389'N" 或 "39 54.389 N"
 * @returns 度分对象，解析失败返回 null
 */
export function parseDM(dmStr: string): { degrees: number; minutes: number; direction: string } | null {
  // 支持多种格式：39°54.389'N, 39 54.389 N, 39d54.389mN
  const patterns = [
    /^(\d+)[°d]\s*([\d.]+)[''′m]?\s*([NSEW])$/i,
    /^(\d+)\s+([\d.]+)\s+([NSEW])$/i,
  ];
  
  for (const pattern of patterns) {
    const match = dmStr.trim().match(pattern);
    if (match) {
      return {
        degrees: parseInt(match[1]),
        minutes: parseFloat(match[2]),
        direction: match[3].toUpperCase(),
      };
    }
  }
  
  return null;
}
