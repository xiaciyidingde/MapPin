import { useEffect, useCallback } from 'react';
import { message } from '../utils/message';
import { useMapStore, useLocationStore } from '../store';
import { appConfig } from '../config/appConfig';
import { locationService } from '../services/location/LocationService';

/**
 * 位置追踪 Hook（重构版）
 * 使用策略模式管理多种定位方式
 * @param autoLocate 是否自动定位
 * @param onHeadingChange 方向变化回调函数
 */
export function useLocationTracking(
  autoLocate: boolean, 
  onHeadingChange?: (heading: number) => void
) {
  const setView = useMapStore((state) => state.setView);
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const userLocation = useMapStore((state) => state.userLocation);
  const locationPermissionDenied = useMapStore((state) => state.locationPermissionDenied);
  const setLocationPermissionDenied = useMapStore((state) => state.setLocationPermissionDenied);

  // 新增：使用定位 Store
  const currentPosition = useLocationStore((state) => state.currentPosition);
  const setCurrentPosition = useLocationStore((state) => state.setCurrentPosition);
  const locationMode = useLocationStore((state) => state.locationMode);
  const setLocationError = useLocationStore((state) => state.setLocationError);

  /**
   * 手动定位到当前位置（重构版）
   */
  const handleLocate = useCallback(async () => {
    if (userLocation) {
      // 强制触发更新：先设置一个临时的不同值，然后再设置目标值
      setView({ lat: userLocation.lat + 0.0001, lng: userLocation.lng }, appConfig.map.locateZoomLevel);
      setTimeout(() => {
        setView(userLocation, appConfig.map.locateZoomLevel);
      }, 10);
      return;
    }

    try {
      // 使用定位服务获取位置
      const position = await locationService.getCurrentPosition();
      
      const location = {
        lat: position.lat,
        lng: position.lng,
      };
      
      setUserLocation(location, position.accuracy);
      setCurrentPosition(position);
      setView(location, appConfig.map.locateZoomLevel);
      setLocationPermissionDenied(false);
      setLocationError(null);
    } catch (error) {
      console.error('无法获取位置:', error);
      const errorMessage = error instanceof Error ? error.message : '无法获取位置信息';
      
      setLocationError(errorMessage);
      
      if (errorMessage.includes('权限')) {
        setLocationPermissionDenied(true);
        message.error('定位权限被拒绝，请在浏览器设置中允许访问位置信息', 5);
      } else if (errorMessage.includes('超时')) {
        message.warning('定位超时，请确保 GPS 已开启并在户外或窗边');
      } else {
        message.error(errorMessage);
      }
    }
  }, [userLocation, setView, setUserLocation, setCurrentPosition, setLocationPermissionDenied, setLocationError]);

  /**
   * 自动追踪用户位置（重构版）
   */
  useEffect(() => {
    if (locationPermissionDenied) {
      return;
    }

    // 使用定位服务监听位置更新
    const watchHandle = locationService.watchPosition((position) => {
      const location = {
        lat: position.lat,
        lng: position.lng,
      };
      
      setUserLocation(location, position.accuracy);
      setCurrentPosition(position);
      setLocationPermissionDenied(false);
      setLocationError(null);
      
      // 获取方向信息
      if (position.heading !== undefined && onHeadingChange) {
        onHeadingChange(position.heading);
      }
      
      // 只有在启用自动定位时才移动地图视图
      if (autoLocate) {
        setView(location, appConfig.map.locateZoomLevel);
      }
    });

    // 清理函数
    return () => {
      watchHandle.remove();
    };
  }, [
    setView, 
    setUserLocation, 
    setCurrentPosition,
    autoLocate, 
    setLocationPermissionDenied, 
    setLocationError,
    locationPermissionDenied, 
    onHeadingChange
  ]);

  return {
    userLocation,
    currentPosition,
    locationMode,
    locationPermissionDenied,
    handleLocate,
  };
}
