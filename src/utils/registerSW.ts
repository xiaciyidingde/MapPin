// Service Worker 注册和管理
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service Worker registered successfully:', registration.scope);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 有新版本可用，自动更新
              console.log('[SW] New version installed and activated');
            }
          });
        }
      });

      // 检查更新
      registration.update();

      return registration;
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  } else {
    console.log('[SW] Service Worker not supported');
  }
};

// 卸载 Service Worker（用于调试）
export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('[SW] Service Worker unregistered');
  }
};

// 清除所有缓存（用于调试）
export const clearAllCaches = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] All caches cleared');
  }
};

// 检查是否在 PWA 模式下运行
export const isPWA = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS Safari specific property
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
};

// 获取安装提示
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 监听安装提示事件
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt available');
    // 触发自定义事件，通知组件可以显示安装提示
    window.dispatchEvent(new Event('pwa-installable'));
  });

  // 监听安装完成事件
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
  });
}

export const getInstallPrompt = () => {
  return {
    showInstallPrompt: async () => {
      if (!deferredPrompt) {
        console.log('[PWA] Install prompt not available');
        return false;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      deferredPrompt = null;
      return outcome === 'accepted';
    },
    isInstallable: () => deferredPrompt !== null,
  };
};
