import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCompass } from './useCompass';

describe('useCompass', () => {
  let mockDeviceOrientationEvent: any;

  beforeEach(() => {
    // 模拟 DeviceOrientationEvent
    mockDeviceOrientationEvent = vi.fn();
    (window as any).DeviceOrientationEvent = mockDeviceOrientationEvent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应该返回初始状态', () => {
    const { result } = renderHook(() => useCompass(false));
    
    expect(result.current.heading).toBe(0);
    expect(typeof result.current.isSupported).toBe('boolean');
  });

  it('当 enabled 为 false 时不应该监听事件', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    
    renderHook(() => useCompass(false));
    
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('deviceorientation', expect.any(Function), true);
  });

  it('当设备不支持时应该设置 isSupported 为 false', () => {
    delete (window as any).DeviceOrientationEvent;
    
    const { result } = renderHook(() => useCompass(true));
    
    expect(result.current.isSupported).toBe(false);
  });
});
