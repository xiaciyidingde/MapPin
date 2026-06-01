import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    // Capacitor / Android 构建产物（含 native-bridge.js 等不应 lint 的代码）
    'android/app/build/**',
    'android/build/**',
    // Capacitor cap sync 同步到 Android 项目下的 web 资产
    'android/app/src/main/assets/public/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/components/Settings/PointSettings.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
