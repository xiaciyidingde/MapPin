# MapPin 开发指南

## 📋 目录

- [项目介绍](#项目介绍)
- [快速开始](#快速开始)
  - [1. 环境准备](#1-环境准备)
  - [2. 下载项目](#2-下载项目)
  - [3. 安装依赖](#3-安装依赖)
  - [4. 配置应用](#4-配置应用)
  - [5. 启动开发](#5-启动开发)
  - [6. 验证安装](#6-验证安装)
- [开发命令](#开发命令)
  - [常用命令速查表](#常用命令速查表)
  - [Android 快速命令](#android-快速命令)
  - [关键文件位置](#关键文件位置)
- [架构与数据流](#架构与数据流)
  - [整体架构](#整体架构)
- [技术栈](#技术栈)
- [Android 侧核心文件](#android-侧核心文件)
- [Web 侧核心文件](#web-侧核心文件)

---

## 项目介绍

MapPin 是一个基于 Web 技术的跨平台地图测量应用，支持高精度 RTK 定位、点位采集、数据管理和导出等功能。

---

## 快速开始

### 1. 环境准备

#### 必需环境

**Node.js**
```bash
# 推荐版本：20.x 或更高
node --version
npm --version
```

**Git**
```bash
git --version
```

#### Android 开发环境（可选）

如果需要开发 Android 版本，需要安装：

**Android Studio**
- 下载地址：https://developer.android.com/studio
- 安装 Android SDK（API 35 或更高）
- 安装 Android NDK（用于 C/C++ 开发）
- 配置环境变量：
  ```bash
  ANDROID_HOME=C:\Users\你的用户名\AppData\Local\Android\Sdk
  ```

**Java JDK**
- 推荐版本：JDK 21（JDK 17 可能会有兼容性问题）
- 下载地址：https://adoptium.net/

### 2. 下载项目

```bash
git clone https://github.com/xiaciyidingde/MapPin.git
cd MapPin
```

### 3. 安装依赖

```bash
npm install
```

### 4. 配置应用

MapPin 使用 `public/app.config.json` 进行配置（运行时动态加载）。

如果需要使用天地图功能，请在应用设置中配置天地图 Token，或直接编辑 `public/app.config.json`。

### 5. 启动开发

```bash
# 启动 Web 开发服务器
npm run dev

# 浏览器打开：http://localhost:5173
```

### 6. 验证安装

```bash
# 运行测试
npm run test:run

# 检查代码质量
npm run lint
```

---

## 开发命令


### 📝 常用命令速查表

#### 🚀 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Web 开发服务器（热重载，访问 http://localhost:5173）|
| `npm run android:dev` | 在 Android 设备上运行（自动构建+同步+安装+启动）|
| `npm run android:open` | 打开 Android Studio 手动开发 |
| `npm run preview` | 预览生产构建 |

**`npm run android:dev` 做了什么？**
- 执行 `cross-env BUILD_TARGET=android npx cap run android`
- Capacitor 自动处理：构建前端 → 同步资源 → 构建 APK → 安装 → 启动

#### 🔨 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 Web 生产版本（输出到 `dist/`）|
| `npm run build:web` | 构建 Web 生产版本（同上）|
| `npm run build:android` | 构建前端并同步到 Android |
| `npm run sync` | 手动同步资源到 Android（需先构建）|

**Android APK 构建**：
```bash
cd android
./gradlew assembleDebug        # Debug 版本
./gradlew assembleRelease      # Release 版本（需配置签名）

# APK 输出位置：
# android/app/build/outputs/apk/debug/app-debug.apk
# android/app/build/outputs/apk/release/app-release.apk
```

#### 🧪 测试命令

| 命令 | 说明 |
|------|------|
| `npm run test` | 运行测试（监听模式）|
| `npm run test:run` | 运行测试（单次执行）|
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run test:ui` | 打开测试 UI 界面 |
| `npm run test:integration` | 运行集成测试（单次）|
| `npm run test:integration:watch` | 运行集成测试（监听模式）|
| `npm run test:all` | 运行所有测试（包括集成测试）|

#### 🔍 代码质量

| 命令 | 说明 |
|------|------|
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm run verify:config` | 验证配置文件使用情况 |
| `npx prettier --write .` | 格式化所有代码 |

#### 其他工具

```bash
# 清理构建产物
rm -rf dist android/app/build node_modules/.vite

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

## 🔧 Android 快速命令

#### Gradle 命令

```bash
cd android

# 构建 Debug APK
./gradlew assembleDebug

# 构建 Release APK（需配置签名）
./gradlew assembleRelease

# 清理构建缓存
./gradlew clean

# 查看所有可用任务
./gradlew tasks
```

#### ADB 常用命令

```bash
# 查看连接的设备
adb devices

# 安装 APK（-r 表示覆盖安装）
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 卸载应用
adb uninstall com.mappin.app

# 清除应用数据
adb shell pm clear com.mappin.app

# 启动应用
adb shell am start -n com.mappin.app/.MainActivity

# 查看实时日志
adb logcat

# 清除日志缓冲区
adb logcat -c

# 过滤特定标签的日志
adb logcat -s TAG_NAME:*

# 过滤多个标签（RTK 相关）
adb logcat -s RTKProcessor:* NTRIPClient:* RTKLIB:*

# 过滤并保存日志
adb logcat -s NTRIPPlugin:* RTKLibWrapper:* > rtk_debug.log

# 保存所有日志到文件
adb logcat > logcat.txt
```

### 🔑 关键文件位置

| 文件 | 说明 |
|------|------|
| `package.json` | 项目依赖和脚本定义 |
| `vite.config.ts` | Vite 构建配置 |
| `capacitor.config.ts` | Capacitor 跨平台配置 |
| `tsconfig.json` | TypeScript 编译配置 |
| `vitest.config.ts` | Vitest 测试配置 |
| `tailwind.config.js` | Tailwind CSS 配置 |
| `public/app.config.json` | 应用运行时配置 |
| `android/app/build.gradle` | Android 构建配置 |
| `android/keystore.properties` | Android 签名配置（不提交）|
| `android/app/src/main/AndroidManifest.xml` | Android 权限和组件配置 |

---

## 架构与数据流

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     React / TypeScript                       │
│         (UI Components + Business Logic)                     │
├─────────────────────────────────────────────────────────────┤
│                     Hook 层                                   │
│  useLocationTracking | useDrawerManager | useDataLoader     │
│  useRTKConnection | useFileUpload                           │
├─────────────────────────────────────────────────────────────┤
│                     Store 层 (Zustand)                       │
│  useDataStore | useMapStore | useLocationStore | useCORSStore│
├─────────────────────────────────────────────────────────────┤
│                     服务层                                    │
│  LocationService | CoordinateConverter | FileParser         │
│  DataService | ExportService | MeasurementService           │
├─────────────────────────────────────────────────────────────┤
│                     策略层                                    │
│  GPSStrategy | CORSStrategy (规划中)                        │
├─────────────────────────────────────────────────────────────┤
│                  Capacitor Plugin Bridge                     │
│  RTKPlugin | NTRIPPlugin | LogCollector | OfflineDebug     │
├─────────────────────────────────────────────────────────────┤
│                  Android 原生层 (Java)                        │
│  RTKProcessor | NTRIPClient | EphemerisDownloader          │
├─────────────────────────────────────────────────────────────┤
│                  JNI 层 (C)                                   │
│  rtklib_jni.c (RTKLibWrapper)                               │
├─────────────────────────────────────────────────────────────┤
│                  RTKLIB 核心 (C)                              │
│  rtkpos | pntpos | rtcm3_decode | satpos | ephemeris       │
└─────────────────────────────────────────────────────────────┘
```

---

## 技术栈

### 前端框架
- **React 19** - UI 框架
- **TypeScript 6** - 类型安全
- **Vite 8** - 构建工具
- **Ant Design 6** - UI 组件库
- **Tailwind CSS 4** - 样式框架

### 地图相关
- **Leaflet** - 地图引擎
- **React Leaflet** - React 集成
- **Proj4** - 坐标转换

### 状态管理
- **Zustand** - 轻量级状态管理

### 数据存储
- **Dexie.js** - IndexedDB 封装

### 移动端
- **Capacitor 8** - 跨平台框架
- **Android NDK** - 原生 C/C++ 开发
- **JNI** - Java 与 C 桥接

### RTK 定位
- **RTKLIB** - RTK 定位库（C）
- **NTRIP** - 差分数据协议

### 测试
- **Vitest** - 单元测试
- **Testing Library** - React 组件测试

### 开发工具
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **TypeScript** - 类型检查

---

## Android 侧核心文件

### Java 层（6 个核心）

```
android/app/src/main/java/com/mappin/app/
├── MainActivity.java           — 应用入口，注册所有 Capacitor 插件
├── RTKPlugin.java              — RTK 控制器 (Capacitor Plugin)
│   ├ Js 桥接：connect / startRTKPositioning / startDebugCollection
│   └ 生命周期：load / handleOnDestroy
├── RTKProcessor.java           — 解算引擎（GNSS 原始数据 → 定位结果）
│   ├ 注册 GnssMeasurementsEvent.Callback
│   ├ P4 状态位过滤 + P3 svid 映射
│   ├ 伪距计算 + DGPS→SPP 双尝试降级
│   └ 每 2 秒推送 RTK 状态
├── RTKLibWrapper.java          — JNI 包装（Java ↔ C 桥接）
│   ├ init / destroy / processObsBatch / decodeRTCM
│   ├ loadRinexNav / loadSp3 / getSolution
│   └ 内部类：GNSSObservation / RTKSolution
├── NTRIPPlugin.java            — NTRIP 连接控制 (Capacitor Plugin)
│   └ connect / disconnect / getConnectionStatus
└── NTRIPClient.java            — NTRIP TCP 客户端
    └ HTTP Basic Auth + RTCM 字节流转发

...辅助插件：LogCollectorPlugin / RTCMAnalyzerPlugin / OfflineDebugCollectorPlugin
...网络服务：EphemerisDownloader（BRDC→SP3 串行下载）
```

### C 层（JNI + RTKLIB 库）

```
android/app/src/main/cpp/
├── rtklib_jni.c                — JNI 桥接核心（~1100 行）
│   ├ nativeInit / nativeDestroy / nativeProcessObsBatch
│   ├ nativeDecodeRTCM / nativeLoadSp3 / nativeGetSolution
│   ├ add_or_replace_eph()（星历去重）
│   └ android_svid_to_rtklib_sat()（卫星编号映射）
├── CMakeLists.txt               — CMake 构建（含多系统编译宏）
└── rtklib/                      — RTKLIB 2.4.3.b34（~50 文件，只读库）
    ├ rtklib.h                   — 库主头文件
    ├ pntpos.c                   — SPP 单点定位
    ├ rtkpos.c                   — DGPS/RTK 定位
    ├ rtcm3.c                    — RTCM3 消息解码
    ├ preceph.c                  — SP3 精密星历处理
    └ ephemeris.c                — 广播星历选择（MAXDTOE 等常量）
```

---

## Web 侧核心文件

### React 组件层

```
src/components/
├── Map/
│   ├── MapView.tsx              — 主地图组件（Leaflet），点位渲染、聚合
│   ├── FitViewControl.tsx       — 自适应缩放按钮
│   ├── GridLayer.tsx            — 网格模式底图
│   └── PointPopup.tsx           — 点位详情弹窗
│
├── Location/
│   ├── RTKIndicator.tsx         — RTK 状态面板（fixType/HDOP/卫星数）
│   ├── CORSManager.tsx          — CORS 基站管理界面
│   ├── LocationPanel.tsx        — 定位设置面板
│   └── LocationStatusIndicator.tsx — 定位状态条
│
├── Settings/
│   ├── SettingsDrawer.tsx       — 设置抽屉入口（含离线调试页）
│   └── ...（GlobalSettings / MapSettings / PointSettings）

...其余 UI 组件：AddPoint/ DataPanel/ FileUpload/ FileMerge/ FileExport/ Search/ Tools/
```

### 服务与状态层

```
src/services/
├── location/                    — 定位策略模式
│   ├── ILocationStrategy.ts     — 策略接口
│   ├── GPSStrategy.ts           — Web GPS 实现
│   ├── CORSStrategy.ts          — CORS RTK 实现
│   └── LocationService.ts       — 门面模式统一定位
├── coordinateConverter.ts       — Proj4 坐标转换
├── fileParser.ts                — .dat 文件解析
├── dataService.ts               — IndexedDB CRUD
├── exportService.ts             — 数据导出
└── tiandituSearchService.ts     — 天地图地名搜索

src/store/                       — Zustand 状态管理
├── useMapStore.ts               — 地图状态（center/zoom/theme/codeFilter）
├── useDataStore.ts              — 文件/点位数据
├── useLocationStore.ts          — 定位状态（mode/position/track）
├── useCORSStore.ts              — CORS/RTK 状态
└── useSettingsStore.ts          — 用户设置

src/hooks/                       — 业务 Hook
├── useLocationTracking.ts       — 位置追踪（含罗盘 compass）
├── useCompass.ts                — 设备罗盘方向
├── useDataLoader.ts             — 数据加载
├── useDrawerManager.ts          — 抽屉管理
├── useNextPointNumber.ts        — 点号自动递增
└── ...
```

### 插件桥接层

```
src/plugins/
├── rtk/
│   ├── definitions.ts           — RTK 插件类型定义
│   ├── index.ts                 — 插件注册入口
│   └── web.ts                   — Web 端占位（throw unavailable）
├── ntrip.ts / ntrip.web.ts      — NTRIP 连接接口
├── logCollector.ts / .web.ts    — 日志收集接口
├── rtcmAnalyzer.ts / .web.ts    — RTCM 分析接口
└── offlineDebugCollector/
    ├── definitions.ts           — 接口定义
    ├── index.ts                 — 注册（复用 RTK 插件通道）
    └── web.ts                   — Web 端占位
```

### 配置与工具

```
src/config/
├── appConfig.ts                 — 运行时配置加载器
├── constants.ts                 — 单文件校验常量（4 个导出）
└── mapTileSources.ts            — 底图源定义

src/utils/
├── sanitize.ts                  — 输入清洗（主工具）
├── mapIcons.ts                  — Leaflet 图标工厂
├── coordinateUtils.ts           — 坐标运算
├── projectionUtils.ts           — 投影参数
├── distanceUtils.ts             — 距离计算（Haversine）
├── pointValidation.ts           — 点位验证
├── coordinateFormatUtils.ts     — DD/DM/DMS/XY 格式互转
└── locationUtils.ts             — 位置工具

src/db/
├── schema.ts                    — Dexie 数据库（5 schema 版本，4 表）

src/types/
├── index.ts                     — 通用类型
├── location.ts                  — 定位/RTC 类型
├── map.ts                       — 地图类型
└── measurement.ts               — 测量类型
```

---
 
**最后更新**: 2026-06-01
