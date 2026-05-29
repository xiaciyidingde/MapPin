/**
 * 位置获取和中央经线计算工具函数
 */

import { message } from '../utils/message';
import { calculateCentralMeridian } from './projectionUtils';

export interface Location {
  lat: number;
  lng: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

/**
 * 请求用户位置信息
 * @returns Promise<Location> 位置信息
 */
export async function requestUserLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * 根据位置计算中央经线
 * @param location 位置信息
 * @param projectionType 投影类型
 * @returns 中央经线值
 */
export function calculateMeridianFromLocation(
  location: Location,
  projectionType: 'gauss-3' | 'gauss-6'
): number {
  return calculateCentralMeridian(location.lng, projectionType);
}

/**
 * 请求位置并计算中央经线（带消息提示）
 * @param projectionType 投影类型
 * @param onSuccess 成功回调
 * @param onError 错误回调（可选）
 */
export async function requestLocationAndCalculateMeridian(
  projectionType: 'gauss-3' | 'gauss-6',
  onSuccess: (location: Location, meridian: number) => void,
  onError?: (error: GeolocationError) => void
): Promise<void> {
  if (!navigator.geolocation) {
    message.error('您的浏览器不支持定位功能');
    return;
  }

  message.loading('正在获取位置信息...', 0);

  try {
    const location = await requestUserLocation();
    const meridian = calculateMeridianFromLocation(location, projectionType);
    
    message.success(`已自动计算中央经线：${meridian}°E`);

    onSuccess(location, meridian);
  } catch (error) {
    const geoError = error as GeolocationPositionError;
    
    if (geoError.code === geoError.PERMISSION_DENIED) {
      message.error('位置权限被拒绝，请在浏览器设置中允许访问位置信息');
    } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
      message.error('无法获取位置信息，请检查设备定位功能是否开启');
    } else if (geoError.code === geoError.TIMEOUT) {
      message.error('获取位置信息超时，请重试');
    } else {
      message.error('无法获取位置信息，请稍后再试');
    }

    onError?.(geoError);
  }
}
