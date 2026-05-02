import { useEffect, useState, useRef } from 'react';
import { message } from 'antd';

/**
 * 网络状态监控组件
 * 监控网络连接状态，在离线/在线时提示用户
 */
export function NetworkStatus() {
  const [, setIsOnline] = useState(navigator.onLine);
  const hasShownOfflineMessageRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      hasShownOfflineMessageRef.current = false;
      message.success('网络已连接', 2);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (!hasShownOfflineMessageRef.current) {
        message.warning({
          content: '网络已断开，应用将继续使用本地数据',
          duration: 5,
          key: 'offline-warning',
        });
        hasShownOfflineMessageRef.current = true;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始检查
    if (!navigator.onLine && !hasShownOfflineMessageRef.current) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // 永远只执行一次

  return null; // 这是一个无 UI 的组件
}
