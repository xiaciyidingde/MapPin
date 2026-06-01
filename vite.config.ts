import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 只在 Web 构建时启用压缩
    process.env.BUILD_TARGET !== 'android' && viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
      deleteOriginFile: false,
    }),
    process.env.BUILD_TARGET !== 'android' && viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
  ].filter(Boolean),
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } as unknown as Record<string, unknown>,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'map-vendor';
            }
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd-vendor';
            }
            if (id.includes('dexie') || id.includes('zustand')) {
              return 'data-vendor';
            }
            if (id.includes('proj4') || id.includes('uuid')) {
              return 'utils-vendor';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    target: 'es2015',
    sourcemap: false,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'leaflet',
      'react-leaflet',
      'antd',
      'zustand',
      'dexie',
    ],
  },
})
