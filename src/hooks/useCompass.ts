import { useEffect, useState, useRef } from 'react';

/**
 * 指南针 Hook
 * 使用设备的方向传感器获取指南针方向
 * @param enabled 是否启用指南针
 * @param throttleDelay 节流延迟（毫秒），默认 100ms
 * @returns heading 当前方向角度（0-360度，0为正北）
 */
export function useCompass(enabled: boolean = true, throttleDelay: number = 100) {
  const [heading, setHeading] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const lastUpdateTime = useRef<number>(0);

  useEffect(() => {
    // 检查设备是否支持方向传感器
    const checkSupport = () => {
      // 检查 DeviceOrientationEvent 是否存在
      if (!window.DeviceOrientationEvent) {
        setIsSupported(false);
        return false;
      }

      // iOS 13+ 需要请求权限
      if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        setIsSupported(true);
        return true;
      }

      // Android 和旧版 iOS 直接支持
      setIsSupported(true);
      return true;
    };

    if (!enabled || !checkSupport()) {
      return;
    }

    // 处理方向变化事件（带节流）
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      
      // 节流：如果距离上次更新时间小于延迟，跳过
      if (now - lastUpdateTime.current < throttleDelay) {
        return;
      }
      
      lastUpdateTime.current = now;

      // 获取指南针方向
      let compassHeading: number | null = null;

      // webkitCompassHeading (iOS Safari)
      const eventWithWebkit = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (eventWithWebkit.webkitCompassHeading !== undefined) {
        compassHeading = eventWithWebkit.webkitCompassHeading;
      }
      // alpha (Android Chrome 和其他浏览器)
      else if (event.alpha !== null) {
        // alpha: 0-360度，0为正北，顺时针增加
        // 但在某些设备上需要反转
        compassHeading = 360 - event.alpha;
      }

      if (compassHeading !== null) {
        // 确保角度在 0-360 范围内
        const normalizedHeading = ((compassHeading % 360) + 360) % 360;
        setHeading(normalizedHeading);
      }
    };

    // iOS 13+ 需要请求权限
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      DeviceOrientationEventWithPermission
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            console.warn('设备方向权限被拒绝');
            setIsSupported(false);
          }
        })
        .catch((error: Error) => {
          console.error('请求设备方向权限失败:', error);
          setIsSupported(false);
        });
    } else {
      // 直接监听事件
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    // 清理函数
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [enabled, throttleDelay]);

  return {
    heading,
    isSupported,
  };
}
