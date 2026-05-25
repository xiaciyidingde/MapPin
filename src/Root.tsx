import { StrictMode, useState, useEffect } from 'react'
import { ConfigProvider } from 'antd'
import App from './App.tsx'
import { AppLoader } from './components/AppLoader'
import { lightTheme, darkTheme } from './themes'
import { useMapStore } from './store'

export function Root() {
  const [loading, setLoading] = useState(true);
  const themeMode = useMapStore((state) => state.theme);

  // 同步 body 背景色
  useEffect(() => {
    document.body.style.backgroundColor = themeMode === 'dark' ? '#141414' : '#ffffff';
  }, [themeMode]);

  return (
    <StrictMode>
      <ConfigProvider theme={themeMode === 'dark' ? darkTheme : lightTheme}>
        {loading ? (
          <AppLoader onLoadComplete={() => setLoading(false)} />
        ) : (
          <App />
        )}
      </ConfigProvider>
    </StrictMode>
  );
}
