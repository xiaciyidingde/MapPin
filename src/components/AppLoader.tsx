import { theme, Button } from 'antd';
import { useEffect, useState, useCallback } from 'react';
import { loadAppConfig, isConfigLoaded } from '../config/appConfig';
import './AppLoader.css';

export function AppLoader({ onLoadComplete }: { onLoadComplete: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = theme.useToken();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await loadAppConfig();
      
      // 确认配置已加载
      if (!isConfigLoaded()) {
        throw new Error('配置加载失败');
      }
      
      onLoadComplete();
    } catch (err) {
      console.error('Failed to load config:', err);
      setError('配置文件加载失败，请检查部署或网络连接');
      setLoading(false);
    }
  }, [onLoadComplete]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  return (
    <div
      className="app-loader"
      style={{
        backgroundColor: token.colorBgContainer,
      }}
    >
      {loading && !error && (
        <>
          <div className="scaling-squares-spinner">
            <div className="square"></div>
            <div className="square"></div>
            <div className="square"></div>
            <div className="square"></div>
          </div>
          <div className="loader-text" style={{ color: token.colorText }}>
            加载中...
          </div>
        </>
      )}
      
      {error && (
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ 
            fontSize: 48, 
            marginBottom: 16,
            color: token.colorError 
          }}>
            ⚠️
          </div>
          <div style={{ 
            fontSize: 16, 
            marginBottom: 24,
            color: token.colorText 
          }}>
            {error}
          </div>
          <Button type="primary" onClick={loadConfig}>
            重试
          </Button>
        </div>
      )}
    </div>
  );
}
