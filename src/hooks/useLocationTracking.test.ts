import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocationTracking } from './useLocationTracking';
import { useMapStore } from '../store';
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
}));

describe('useLocationTracking', () => {
  const mockSetView = vi.fn();
  const mockSetUserLocation = vi.fn();
  const mockSetLocationPermissionDenied = vi.fn();

  // Mock geolocation
  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该在挂载时获取当前位置', () => {
      renderHook(() => useLocationTracking(false));

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('应该在获取位置成功时更新状态', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
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
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
      });

      renderHook(() => useLocationTracking(true));

      await waitFor(() => {
        expect(mockSetView).toHaveBeenCalledWith({ lat: 39.9, lng: 116.4 }, 18);
      });
    });

    it('应该在 autoLocate 为 false 时不移动地图视图', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
      });

      renderHook(() => useLocationTracking(false));

      await waitFor(() => {
        expect(mockSetUserLocation).toHaveBeenCalled();
      });

      expect(mockSetView).not.toHaveBeenCalled();
    });

    it('应该在权限被拒绝时设置状态', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1 });
      });

      renderHook(() => useLocationTracking(false));

      await waitFor(() => {
        expect(mockSetLocationPermissionDenied).toHaveBeenCalledWith(true);
      });
    });

    it('应该启动位置监听', () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
      });

      mockGeolocation.watchPosition.mockReturnValue(123);

      renderHook(() => useLocationTracking(false));

      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
    });

    it('应该在卸载时清除位置监听', () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
      });

      const watchId = 123;
      mockGeolocation.watchPosition.mockReturnValue(watchId);

      const { unmount } = renderHook(() => useLocationTracking(false));

      unmount();

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId);
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

    it('应该在没有用户位置时获取新位置', () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 10,
          },
        });
      });

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.handleLocate();
      });

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('应该在权限被拒绝时显示错误消息', async () => {
      mockGeolocation.getCurrentPosition
        .mockImplementationOnce((success) => {
          success({
            coords: {
              latitude: 39.9,
              longitude: 116.4,
              accuracy: 10,
            },
          });
        })
        .mockImplementationOnce((_, error) => {
          error({
            code: 1,
            message: 'Permission denied',
            PERMISSION_DENIED: 1,
          });
        });

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.handleLocate();
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
      mockGeolocation.getCurrentPosition
        .mockImplementationOnce((success) => {
          success({
            coords: {
              latitude: 39.9,
              longitude: 116.4,
              accuracy: 10,
            },
          });
        })
        .mockImplementationOnce((_, error) => {
          error({
            code: 3,
            message: 'Timeout',
            TIMEOUT: 3,
          });
        });

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.handleLocate();
      });

      await waitFor(() => {
        expect(message.warning).toHaveBeenCalledWith(
          '定位超时，请确保 GPS 已开启并在户外或窗边'
        );
      });
    });

    it('应该在其他错误时显示通用错误消息', async () => {
      mockGeolocation.getCurrentPosition
        .mockImplementationOnce((success) => {
          success({
            coords: {
              latitude: 39.9,
              longitude: 116.4,
              accuracy: 10,
            },
          });
        })
        .mockImplementationOnce((_, error) => {
          error({
            code: 2,
            message: 'Position unavailable',
            POSITION_UNAVAILABLE: 2,
          });
        });

      const { result } = renderHook(() => useLocationTracking(false));

      act(() => {
        result.current.handleLocate();
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
