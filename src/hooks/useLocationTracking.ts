import { useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useMapStore } from '../store';

/**
 * 位置追踪 Hook
 * 管理用户位置的获取和持续追踪
 */
export function useLocationTracking(autoLocate: boolean) {
  const setView = useMapStore((state) => state.setView);
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const userLocation = useMapStore((state) => state.userLocation);
  const locationPermissionDenied = useMapStore((state) => state.locationPermissionDenied);
  const setLocationPermissionDenied = useMapStore((state) => state.setLocationPermissionDenied);

  /**
   * 手动定位到当前位置
   */
  const handleLocate = useCallback(() => {
    if (userLocation) {
      // 强制触发更新：先设置一个临时的不同值，然后再设置目标值
      setView({ lat: userLocation.lat + 0.0001, lng: userLocation.lng }, 18);
      setTimeout(() => {
        setView(userLocation, 18);
      }, 10);
    } else if (navigator.geolocation) {
      // 高精度定位配置
      const highAccuracyOptions: PositionOptions = {
        enableHighAccuracy: true,  // 启用高精度模式（GPS）
        timeout: 10000,            // 10秒超时
        maximumAge: 0,             // 不使用缓存
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const accuracy = position.coords.accuracy;
          setUserLocation(location, accuracy);
          setView(location, 18);
          setLocationPermissionDenied(false);
        },
        (error) => {
          console.error('无法获取位置:', error);
          
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionDenied(true);
            message.error({
              content: '定位权限被拒绝，请在浏览器设置中允许访问位置信息',
              duration: 5,
            });
          } else if (error.code === error.TIMEOUT) {
            message.warning('定位超时，请确保 GPS 已开启并在户外或窗边');
          } else {
            message.error('无法获取位置信息');
          }
        },
        highAccuracyOptions
      );
    }
  }, [userLocation, setView, setUserLocation, setLocationPermissionDenied]);

  /**
   * 自动追踪用户位置
   */
  useEffect(() => {
    let watchId: number | null = null;

    if (navigator.geolocation) {
      // 高精度定位配置
      const highAccuracyOptions: PositionOptions = {
        enableHighAccuracy: true,  // 启用高精度模式（GPS）
        timeout: 10000,            // 10秒超时
        maximumAge: 0,             // 不使用缓存，每次都获取新位置
      };

      // 首次获取位置
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const accuracy = position.coords.accuracy;
          setUserLocation(location, accuracy);
          setLocationPermissionDenied(false);
          
          // 只有在启用自动定位时才移动地图视图
          if (autoLocate) {
            setView(location, 16);
          }
        },
        (error) => {
          console.warn('无法获取当前位置:', error.message);
          
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionDenied(true);
            // 权限被拒绝时不显示消息，避免打扰
            // 用户点击定位按钮时会显示提示
          } else if (error.code === error.TIMEOUT) {
            console.warn('定位超时，可能是 GPS 信号弱');
          }
        },
        highAccuracyOptions
      );

      // 只有在权限未被拒绝时才持续监听位置更新
      if (!locationPermissionDenied) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            const accuracy = position.coords.accuracy;
            setUserLocation(location, accuracy);
            setLocationPermissionDenied(false);
          },
          (error) => {
            console.warn('位置更新失败:', error.message);
            
            if (error.code === error.PERMISSION_DENIED) {
              setLocationPermissionDenied(true);
              // 停止监听
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
              }
            }
          },
          {
            enableHighAccuracy: true,  // 启用高精度模式（GPS）
            timeout: 15000,            // 15秒超时（持续监听可以设置更长）
            maximumAge: 5000,          // 5秒缓存（减少GPS功耗）
          }
        );
      }
    }

    // 清理函数
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [setView, setUserLocation, autoLocate, setLocationPermissionDenied, locationPermissionDenied]);

  return {
    userLocation,
    locationPermissionDenied,
    handleLocate,
  };
}
