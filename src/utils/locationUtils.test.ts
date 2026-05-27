import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestUserLocation,
  calculateMeridianFromLocation,
  requestLocationAndCalculateMeridian,
} from './locationUtils';
import * as projectionUtils from './projectionUtils';

// Mock antd message
vi.mock('antd', () => ({
  message: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    destroy: vi.fn(),
  },
}));

describe('locationUtils', () => {
  let mockGeolocation: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock navigator.geolocation
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestUserLocation', () => {
    it('应该成功获取用户位置', async () => {
      const mockPosition = {
        coords: {
          latitude: 39.9042,
          longitude: 116.4074,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const location = await requestUserLocation();

      expect(location).toEqual({
        lat: 39.9042,
        lng: 116.4074,
      });
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });

    it('应该在浏览器不支持定位时拒绝', async () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      await expect(requestUserLocation()).rejects.toThrow('浏览器不支持定位功能');
    });

    it('应该在定位失败时拒绝', async () => {
      const mockError = {
        code: 1,
        message: 'User denied geolocation',
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      await expect(requestUserLocation()).rejects.toEqual(mockError);
    });
  });

  describe('calculateMeridianFromLocation', () => {
    it('应该为 3 度带计算中央经线', () => {
      const spy = vi.spyOn(projectionUtils, 'calculateCentralMeridian');
      spy.mockReturnValue(117);

      const location = { lat: 39.9042, lng: 116.4074 };
      const meridian = calculateMeridianFromLocation(location, 'gauss-3');

      expect(meridian).toBe(117);
      expect(spy).toHaveBeenCalledWith(116.4074, 'gauss-3');
    });

    it('应该为 6 度带计算中央经线', () => {
      const spy = vi.spyOn(projectionUtils, 'calculateCentralMeridian');
      spy.mockReturnValue(117);

      const location = { lat: 39.9042, lng: 116.4074 };
      const meridian = calculateMeridianFromLocation(location, 'gauss-6');

      expect(meridian).toBe(117);
      expect(spy).toHaveBeenCalledWith(116.4074, 'gauss-6');
    });
  });

  describe('requestLocationAndCalculateMeridian', () => {
    it('应该成功获取位置并计算中央经线', async () => {
      const mockPosition = {
        coords: {
          latitude: 39.9042,
          longitude: 116.4074,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const spy = vi.spyOn(projectionUtils, 'calculateCentralMeridian');
      spy.mockReturnValue(117);

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith(
        { lat: 39.9042, lng: 116.4074 },
        117
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('应该在浏览器不支持定位时显示错误', async () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('应该在权限被拒绝时显示错误', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it('应该在位置不可用时显示错误', async () => {
      const mockError = {
        code: 2, // POSITION_UNAVAILABLE
        message: 'Position unavailable',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it('应该在超时时显示错误', async () => {
      const mockError = {
        code: 3, // TIMEOUT
        message: 'Timeout',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it('应该在未知错误时显示通用错误', async () => {
      const mockError = {
        code: 999, // Unknown error
        message: 'Unknown error',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await requestLocationAndCalculateMeridian('gauss-3', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(mockError);
    });
  });
});
