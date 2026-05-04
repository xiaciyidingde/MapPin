/**
 * 移动端触摸优化工具
 */

/**
 * 启用触摸优化
 * - 防止长按菜单（仅在地图区域）
 */
export const enableTouchOptimization = () => {
  // 防止长按菜单（仅在地图容器内）
  document.addEventListener('contextmenu', (event) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.leaflet-container')
    ) {
      event.preventDefault();
    }
  });

  // 优化滚动性能
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // 添加触摸类名到 body，用于 CSS 样式判断
  document.body.classList.add('touch-device');
};

/**
 * 检测是否为触摸设备
 */
export const isTouchDevice = (): boolean => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - IE specific property
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * 获取设备类型
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  
  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
};

/**
 * 检测是否为 iOS 设备
 */
export const isIOS = (): boolean => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad on iOS 13+
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/**
 * 检测是否为 Android 设备
 */
export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

/**
 * 优化 iOS 输入框体验
 * 防止输入时页面缩放
 */
export const optimizeIOSInput = () => {
  if (!isIOS()) return;

  // 监听输入框聚焦
  document.addEventListener('focusin', (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      // 禁用缩放
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
      }
    }
  });

  // 监听输入框失焦
  document.addEventListener('focusout', () => {
    // 恢复缩放
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'
      );
    }
  });
};
