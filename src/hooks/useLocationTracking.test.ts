import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocationTracking } from './useLocationTracking';
import { useMapStore, useLocationStore } from '../store';
import { message } from '../utils/message';

// Mock appConfig
vi.mock('../config/appConfig', () => ({
  appConfig: {
    location: {
      updateInterval: 5000,
      timeout: 10000,
    },
    map: {
      locateZoomLevel: 18,
    },
    ui: {
      messageDisplayDuration: 3000,
    },
  },
}));

// Mock message utility
vi.mock('../utils/message', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock stores
vi.mock('../store', () => ({
  useMapStore: vi.fn(),
  useLocationStore: vi.fn(),
}));

// Mock locationService - 使用 vi.fn() 在 factory 内部创建
vi.mock('../services/location/LocationService', () => ({
  locationService: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
  },
}));

// 导入 mocked locationService 以便在测试中使用
import { locationService } from '../services/location/LocationService';

describe('useLocationTracking', () => {
  const mockSetView = vi.fn();
  const mockSetUserLocation = vi.fn();
  const mockSetLocationPermissionDenied = vi.fn();
  const mockSetCurrentPosition = vi.fn();
  const mockSetLocationError = vi.fn();
  const mockRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock watchPosition to return a remove function
    vi.mocked(locationService.watchPosition).mockReturnValue({ remove: mockRemove });

    // Mock useMapStore
    vi.mocked(useMapStore).mockImplementation((selector: any) => {
      const state = {
        setView: mockSetView,
        setUserLocation: mockSetUserLocation,
        userLocation: null,
        locationPermissionDenied: false,
        setLocationPermissionDenied: mockSetLocationPermissionDenied,
      };
      return selector(state);
    });

    // Mock useLocationStore
    vi.mocked(useLocationStore).mockImplementation((selector: any) => {
      const state = {
        currentPosition: null,
        setCurrentPosition: mockSetCurrentPosition,
        locationMode: 'gps',
        setLocationError: mockSetLocationError,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该在挂载时启动位置监听', () => {
      renderHook(() => useLocationTracking(false));

      expect(locationService.watchPosition).toHaveBeenCalled();
    });

    it('应该在获取位置成功时更新状态', async () => {
      vi.mocked(locationService.watchPosition).mockImplementation((callback) => {
        // 立即调用回调模拟位置更新
        callback({
          lat: 39.9,
          lng: 116.4,
          accuracy: 10,
          timestamp: Date.now(),
        });
        return { remove: mockRemove };
      });

      renderHook(() => useLocationTracking(false));

      await waitFor(() => {
        expect(mockSetUserLocation).toHaveBeenCalledWith(
          { lat: 39.9, lng: 116.4 },
          10
        );
        expect(mockSetLocationPermissionDenied).toHaveBeenCalledWith(false);
      });
    });

    it('应该在 autoLocate 为 true 时移动地图视图', async () => {
      vi.mocked(locationService.watchPosition).mockImplementation((callback) => {
        callback({
          lat: 39.9,
          lng: 116.4,
          accuracy: 10,
          timestamp: Date.now(),
        });
        return { remove: mockRemove };
      });

      renderHook(() => useLocationTracking(true));

      await waitFor(() => {
        expect(mockSetView).toHaveBeenCalledWith({ lat: 39.9, lng: 116.4 }, 18);
      });
    });

    it('应该在 autoLocate 为 false 时不移动地图视图', async () => {
      vi.mocked(locationService.watchPosition).mockImplementation((callback) => {
        callback({
          lat: 39.9,
          lng: 116.4,
          accuracy: 10,
          timestamp: Date.now(),
        });
        return { remove: mockRemove };
      });

      renderHook(() => useLocationTracking(false));

      await waitFor(() => {
        expect(mockSetUserLocation).toHaveBeenCalled();
      });

      expect(mockSetView).not.toHaveBeenCalled();
    });

    it('应该在权限被拒绝时不启动监听', async () => {
      vi.mocked(useMapStore).mockImplementation((selector: any) => {
        const state = {
          setView: mockSetView,
          setUserLocation: mockSetUserLocation,
          userLocation: null,
          locationPermissionDenied: true,
          setLocationPermissionDenied: mockSetLocationPermissionDenied,
        };
        return selector(state);
      });

      renderHook(() => useLocationTracking(false));

      // 当权限被拒绝时，不应该调用 watchPosition
      expect(locationService.watchPosition).not.toHaveBeenCalled();
    });

    it('应该启动位置监听', () => {
      renderHook(() => useLocationTracking(false));

      expect(locationService.watchPosition).toHaveBeenCalled();
    });

    it('应该在卸载时清除位置监听', () => {
      const { unmount } = renderHook(() => useLocationTracking(false));

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('handleLocate', () => {
    it('应该在有用户位置时移动到该位置', () => {
      vi.mocked(useMapStore).mockImplementation((selector: any) => {
        const state = {
          setView: mockSetView,
          setUserLocation: mockSetUserLocation,
          userLocation: { lat: 39.9, lng: 116.4 },
          locationPermissionDenied: false,
          setLocationPermissionDenied: mockSetLocationPermissionDenied,
        };
        return selector(state);
      });

      vi.useFakeTimers();

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.handleLocate();
      });

      expect(mockSetView).toHaveBeenCalledWith(
        { lat: 39.9001, lng: 116.4 },
        18
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(mockSetView).toHaveBeenCalledWith({ lat: 39.9, lng: 116.4 }, 18);

      vi.useRealTimers();
    });

    it('应该在没有用户位置时获取新位置', async () => {
      vi.mocked(locationService.getCurrentPosition).mockResolvedValue({
        lat: 39.9,
        lng: 116.4,
        accuracy: 10,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.handleLocate();
      });

      expect(locationService.getCurrentPosition).toHaveBeenCalled();
      expect(mockSetUserLocation).toHaveBeenCalledWith(
        { lat: 39.9, lng: 116.4 },
        10
      );
    });

    it('应该在权限被拒绝时显示错误消息', async () => {
      vi.mocked(locationService.getCurrentPosition).mockRejectedValue(new Error('定位权限被拒绝'));

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.handleLocate();
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith(
          '定位权限被拒绝，请在浏览器设置中允许访问位置信息',
          5
        );
      });

      expect(mockSetLocationPermissionDenied).toHaveBeenCalledWith(true);
    });

    it('应该在超时时显示警告消息', async () => {
      vi.mocked(locationService.getCurrentPosition).mockRejectedValue(new Error('定位超时'));

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.handleLocate();
      });

      await waitFor(() => {
        expect(message.warning).toHaveBeenCalledWith(
          '定位超时，请确保 GPS 已开启并在户外或窗边'
        );
      });
    });

    it('应该在其他错误时显示通用错误消息', async () => {
      vi.mocked(locationService.getCurrentPosition).mockRejectedValue(new Error('无法获取位置信息'));

      const { result } = renderHook(() => useLocationTracking(false));

      await act(async () => {
        await result.current.handleLocate();
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('无法获取位置信息');
      });
    });
  });

  describe('返回值', () => {
    it('应该返回用户位置', () => {
      vi.mocked(useMapStore).mockImplementation((selector: any) => {
        const state = {
          setView: mockSetView,
          setUserLocation: mockSetUserLocation,
          userLocation: { lat: 39.9, lng: 116.4 },
          locationPermissionDenied: false,
          setLocationPermissionDenied: mockSetLocationPermissionDenied,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLocationTracking(false));

      expect(result.current.userLocation).toEqual({ lat: 39.9, lng: 116.4 });
    });

    it('应该返回权限拒绝状态', () => {
      vi.mocked(useMapStore).mockImplementation((selector: any) => {
        const state = {
          setView: mockSetView,
          setUserLocation: mockSetUserLocation,
          userLocation: null,
          locationPermissionDenied: true,
          setLocationPermissionDenied: mockSetLocationPermissionDenied,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLocationTracking(false));

      expect(result.current.locationPermissionDenied).toBe(true);
    });

    it('应该返回 handleLocate 函数', () => {
      const { result } = renderHook(() => useLocationTracking(false));

      expect(typeof result.current.handleLocate).toBe('function');
    });
  });
});
