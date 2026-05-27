import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTitleAnimation } from './useTitleAnimation';

describe('useTitleAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('应该在宽屏上始终显示标题', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useTitleAnimation());

    expect(result.current.showTitle).toBe(true);
    expect(result.current.startAnimation).toBe(false);
  });

  it('应该在小屏幕上启动动画并隐藏标题', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400,
    });

    const { result } = renderHook(() => useTitleAnimation());

    // 初始状态
    expect(result.current.showTitle).toBe(true);
    expect(result.current.startAnimation).toBe(false);

    // 1 秒后开始动画
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.startAnimation).toBe(true);
    expect(result.current.showTitle).toBe(true);

    // 再过 1 秒后隐藏标题
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.showTitle).toBe(false);
  });

  it('应该在窗口大小变化时重新检查', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useTitleAnimation());

    expect(result.current.showTitle).toBe(true);
    expect(result.current.startAnimation).toBe(false);

    // 改变窗口大小到小屏幕
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });
      window.dispatchEvent(new Event('resize'));
    });

    // 1 秒后开始动画
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.startAnimation).toBe(true);
  });

  it('应该在从小屏幕切换到大屏幕时重置状态', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400,
    });

    const { result } = renderHook(() => useTitleAnimation());

    // 等待动画开始
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.startAnimation).toBe(true);

    // 改变窗口大小到大屏幕
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.showTitle).toBe(true);
    expect(result.current.startAnimation).toBe(false);
  });

  it('应该在 500px 边界上正确工作', () => {
    // 刚好 500px - 应该显示标题
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useTitleAnimation());

    expect(result.current.showTitle).toBe(true);
    expect(result.current.startAnimation).toBe(false);

    // 499px - 应该启动动画
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 499,
      });
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.startAnimation).toBe(true);
  });

  it('应该清理定时器', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400,
    });

    const { unmount } = renderHook(() => useTitleAnimation());

    // 先运行所有定时器
    act(() => {
      vi.runAllTimers();
    });

    // 卸载前清理定时器
    unmount();

    // 确保定时器被清理
    expect(vi.getTimerCount()).toBe(0);
  });

  it('应该清理 resize 事件监听器', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTitleAnimation());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
