# MapPin - 测绘数据可视化平台

<div align="center">

**跨平台测绘数据采集与管理工具**

<p align="center">
  <img src="https://img.shields.io/badge/平台-Web%20%7C%20PWA%20%7C%20Android-green.svg" alt="平台">
  <img src="https://img.shields.io/badge/React-19.2-61dafb.svg" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178c6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF.svg" alt="Vite">
  <img src="https://img.shields.io/badge/Capacitor-8.3-53B9FF.svg" alt="Capacitor">
  <img src="https://img.shields.io/badge/许可证-CC%20BY--NC%204.0-orange.svg" alt="许可证">
</p>

</div>

---

MapPin 是一个功能强大的跨平台测绘数据采集与管理应用，支持 Web、PWA 和 Android 平台。集成了 RTKLIB 算法库，提供基础的 GNSS 数据处理能力。

<div align="center">
  <img src="./img/1.png" alt="截图1" width="45%">
  <img src="./img/2.png" alt="截图2" width="45%">
</div>

> 演示和项目中的测试数据均由 `tools/generate_test_data.py` 生成

## 📚 文档导航

- **[开发指南](./docs/DEVELOPMENT_GUIDE.md)** - 开发环境、项目结构、架构与数据流、开发流程
- **[配置说明](./docs/CONFIGURATION.md)** - app.config.json 配置项详细说明
- **[更新日志](./CHANGELOG.md)** - 版本更新历史

## ✨ 核心功能

### 📡 定位功能

#### Web/PWA 平台
- **GPS 定位**：基于浏览器 Geolocation API
- **实时位置显示**：显示当前位置和定位精度

#### Android 平台
- **GNSS 原始数据采集**：实时采集 GNSS 测量数据
- **CORS 基站连接**：NTRIP 协议连接 CORS 基站
- **RTK 高精度定位**：集成 RTKLIB 算法库(待完善))
- **智能星历管理**：三层星历获取方案
  - 主方案：CORS RTCM 数据（实时）
  - 备用方案 1：IGS 服务器下载广播星历（自动）
  - 备用方案 2：设备导航消息（如果支持）
- **RTCM 数据分析**：实时分析差分数据质量
- **日志收集**：应用日志导出，便于问题排查

### 📱 PWA 支持
- **安装到桌面**：可像原生 App 一样安装到手机/电脑桌面
- **离线访问**：支持离线使用，无需网络连接
- **智能缓存**：地图瓦片和静态资源自动缓存

### 🎨 主题系统
- **深色/浅色主题**：支持系统级主题切换
- **动画效果**：两种主题切换动画可选
  - 简单扩散
  - 三段动画
- **主题持久化**：主题设置自动保存

### 📁 文件管理
- **文件导入**：支持 .dat 格式文件上传（简单格式和详细格式）
- **文件创建**：直接创建空白文件并手动添加点位
- **文件合并**：合并两个测量文件，智能处理冲突点
- **回收站**：误删文件可从回收站恢复
- **文件导出**：支持导出为 .dat 格式，可自定义导出内容

### 🗺️ 地图展示
- **多种底图**：OpenStreetMap、天地图（矢量/影像/地形）
- **底图切换**：地图模式 / 网格模式
- **智能聚合**：大量点位自动聚合，提升性能
- **点位标签**：可选显示点位号悬浮标签

### 📍 点位管理
- **点位类型**：碎部点（蓝色）/ 控制点（红色）
- **点位操作**：重命名、删除、类型切换
- **手动添加**：基于当前位置或自定义坐标添加点位
- **点位搜索**：快速搜索和定位点位
- **点位筛选**：按类型筛选（全部/碎部点/控制点/手动点）
- **点位设置**：批量管理和编辑点位信息

### 🏷️ 地名搜索
- **地名搜索**：搜索具体地点（如"北京大学"）
- **周边搜索**：两种方式触发，意图词触发（如"附近的+地名：附近的餐厅），类别词触发（如"超市"）
- **距离显示**：显示搜索结果到当前位置的距离

### 📏 测量工具
- **距离测量**：测量任意两点间的空间距离和平面距离
- **高差计算**：自动计算两点间的高程差

### 🔍 异常检测
- **精度异常**：检测 HRMS/VRMS 超标点位
- **孤立点检测**：识别距离其他点过远的孤立点
- **统计分析**：显示总点数、异常数、平均精度等统计信息
- **分类展示**：按异常类型分组显示，支持定位和导出

### 🌐 坐标系统
- **多坐标系支持**：CGCS2000、Beijing54、Xian80、WGS84
- **投影方式**：高斯-克吕格投影（3°带 / 6°带）
- **中央经线**：可自定义或根据位置自动计算
- **坐标转换**：自动进行坐标系统转换

### 📱 定位功能
- **实时定位**：显示当前位置和定位精度

## 🛠️ 技术栈

### 前端技术
- **前端框架**：React 19 + TypeScript 6
- **构建工具**：Vite 8
- **UI 组件**：Ant Design 6
- **地图引擎**：Leaflet 1.9 + React-Leaflet 5.0
- **数据存储**：Dexie.js (IndexedDB)
- **状态管理**：Zustand 5
- **坐标转换**：Proj4js
- **跨平台**：Capacitor 8.3
- **测试框架**：Vitest + Testing Library

### Android 原生
- **语言**：Java 11
- **构建**：Gradle 8
- **NDK**：27.0.12077973
- **CMake**：3.22+
- **RTKLIB**：2.4.3.b34（C/C++ 算法库）
- **JNI**：Java 与 C/C++ 桥接

### 核心组件
- **NTRIPPlugin**：Capacitor 插件，连接前端与原生层
- **RTKProcessor**：RTK 处理核心，管理 GNSS 数据和解算
- **NTRIPClient**：NTRIP 客户端，连接 CORS 基站
- **EphemerisDownloader**：星历下载器，多源星历获取
- **RTKLibWrapper**：RTKLIB JNI 封装，调用 C 算法库
- **LogCollectorPlugin**：日志收集插件

详见 [开发指南](./docs/DEVELOPMENT_GUIDE.md)

## ⚙️ 配置说明

MapPin 使用 `public/app.config.json` 进行配置，支持运行时动态加载。

### 天地图 Token 配置

**⚠️ 重要提示：**
项目默认不包含天地图 Token。如需使用天地图功能：
1. 访问 [天地图开发者平台](https://console.tianditu.gov.cn/) 申请 Token（免费）
2. 在**应用设置 > 地图设置**中配置 Token
3. 或直接编辑 `app.config.json` 中的 `map.tianDiTuTokens` 数组

***⚠️ 公网部署请设置白名单，防止 Token 被盗用！***

### 完整配置说明

详细的配置项说明请查看 **[配置文档](./docs/CONFIGURATION.md)**，包括：
- 地图配置（底图源、Token、缓存）
- 定位配置（超时、精度要求）
- 坐标系统配置
- 文件格式配置
- ...

## 🚀 快速开始

MapPin 支持 Web 和 Android 双平台。

### 开发环境配置

详细的环境配置、依赖安装、开发命令请查看 **[开发指南 - 快速开始](./docs/DEVELOPMENT_GUIDE.md#快速开始)**。

### 常用命令速览

```bash
# Web 开发
npm install          # 安装依赖
npm run dev          # 启动开发服务器

# Android 开发
npm run android:dev  # 一键构建、安装、启动
npm run android:open # 打开 Android Studio

# 代码质量
npm run lint         # 代码检查
npm test             # 运行测试
```

更多命令和详细说明请查看 **[开发指南 - 开发命令](./docs/DEVELOPMENT_GUIDE.md#开发命令)**。

## 🧪 测试

### 快速测试

```bash
# 运行完整测试流程
npm run test:all

# 或单独运行测试
npm test
```

详细的测试命令、测试策略、覆盖率报告等请查看 **[开发指南](./docs/DEVELOPMENT_GUIDE.md)**。

## 📦 打包为原生应用

MapPin 作为 PWA 应用，可以使用 [PWABuilder](https://www.pwabuilder.com/) 打包为各平台原生应用。

### 打包步骤

1. 构建生产版本：`npm run build`
2. 部署到 HTTPS 服务器
3. 访问 [PWABuilder](https://www.pwabuilder.com/) 并输入你的网站 URL
4. 选择目标平台（Android / iOS / Windows / Meta Quest）并下载安装包

详细的打包和发布流程请查看 **[开发指南](./docs/DEVELOPMENT_GUIDE.md)**。
   

## 🎯 点位类型

- **碎部点**（蓝色圆点）：测量的地形地物点
- **控制点**（红色三角形）：控制测量的基准点
- **手动添加点**：标记为"手动添加"

用户可以随时切换点位类型。

## 📄 许可证

CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International)

本项目采用知识共享署名-非商业性使用 4.0 国际许可协议进行许可。

**您可以自由地：**
- ✅ 共享 — 在任何媒介以任何形式复制、发行本作品
- ✅ 演绎 — 修改、转换或以本作品为基础进行创作

**惟须遵守下列条件：**
- ✅ 署名 — 您必须给出适当的署名，提供指向本许可协议的链接，同时标明是否（对原始作品）作了修改
- ❌ 非商业性使用 — 您不得将本作品用于商业目的

详细信息请访问：https://creativecommons.org/licenses/by-nc/4.0/

