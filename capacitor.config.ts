import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mappin.app',
  appName: 'MapPin',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // 开发时允许 HTTP
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1890ff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1890ff',
    },
  },
};

export default config;
