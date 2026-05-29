# MapPin 配置文档

本文档说明 `public/app.config.json` 中所有可配置项的含义和用途。

## 配置文件位置

`public/app.config.json`

## 配置修改说明

1. 修改 `public/app.config.json` 文件
2. 重新加载应用（刷新页面），配置会自动生效

## 注意事项

- 所有配置都有默认值（在 `src/config/appConfig.ts` 中定义）
- 如果配置文件加载失败，会使用默认值

---

## 配置项详细说明

### app - 应用信息
```json
{
  "name": "MapPin",
  "description": "测量数据管理与可视化工具"
}
```
- `name`: 应用名称
- `description`: 应用描述

### author - 作者信息
```json
{
  "show": true,
  "showLinks": true,
  "links": [
    {
      "title": "GitHub",
      "url": "https://github.com/xiaciyidingde/MapPin",
      "icon": "github",
      "description": "github.com/xiaciyidingde/MapPin"
    }
  ]
}
```
- `show`: 是否显示作者信息
- `showLinks`: 是否显示链接
  
- `links`: 链接列表数组，每个链接包含：
  - `title`: 链接标题
  - `url`: 链接地址
  - `icon`: 图标地址
  - `description`: 描述文本

### coordinate - 坐标系统配置
```json
{
  "defaultSystem": "CGCS2000",
  "defaultProjection": "gauss-3",
  "defaultCentralMeridian": 114,
  "centralMeridianRange": {
    "min": 75,
    "max": 135
  }
}
```
- `defaultSystem`: 创建或导入文件时的默认坐标系统
  - 可选值：`CGCS2000`、`Beijing54`、`Xian80`、`WGS84`
  
- `defaultProjection`: 默认投影方式
  - 可选值：`gauss-3`（3°带）、`gauss-6`（6°带）
  
- `defaultCentralMeridian`: 默认中央经线（度）
  - 范围：75°E - 135°E
  
- `centralMeridianRange`: 中央经线可选范围
  - `min`: 最小值（75°E）
  - `max`: 最大值（135°E）
  - 用于设置界面的输入范围限制

### location - 位置追踪配置
```json
{
  "updateInterval": 5000,
  "timeout": 10000
}
```
- `updateInterval`: 位置更新间隔（毫秒），默认 5000ms
  - 控制 GPS 多久获取一次新位置
  
- `timeout`: 定位请求超时时间（毫秒），默认 10000ms
  - 超过此时间未获取到位置则报错
  - 避免定位请求无限等待

### map - 地图配置
```json
{
  "defaultCenter": { "lat": 39.9, "lng": 116.4 },
  "defaultZoom": 15,
  "locateZoomLevel": 18,
  "minZoom": 3,
  "maxZoom": 25,
  "defaultTileSource": "osm",
  "disabledTileSources": [],
  "tianDiTuTokens": []
}
```
- `defaultCenter`: 默认地图中心
  - `lat`: 纬度
  - `lng`: 经度
  
- `defaultZoom`: 默认缩放级别，默认 15
  - 应用首次打开时的地图缩放级别
  - 范围：3-25
  
- `locateZoomLevel`: 定位时的缩放级别，默认 18
  - 点击定位按钮或自动定位时，地图缩放到的级别
  
- `minZoom`: 最小缩放级别，默认 3
  - 用户可以缩小到的最小级别
  
- `maxZoom`: 最大缩放级别，默认 25
  - 用户可以放大到的最大级别
  
- `defaultTileSource`: 默认底图源，默认 "osm"
  - 可选值：`osm`、`tianditu-vec`、`tianditu-img`、`tianditu-ter`
  
- `disabledTileSources`: 禁用的底图源列表
  - 例如：`["osm", "tianditu-ter"]` 会隐藏 OSM 和天地图地形
  
- `tianDiTuTokens`: 天地图公共 Token 列表
  - 例如：`["token1", "token2", "token3"]`
  - 支持负载均衡：多个 Token 轮流使用
  - 支持故障转移：当一个 Token 失败时自动切换到下一个
  - 申请地址：https://console.tianditu.gov.cn/
  - ***！！！如果部署在公网环境中，申请 Token 后请在天地图中设置白名单，防止 Token 被盗用。***

### file - 文件配置
```json
{
  "maxSizeMB": 50
}
```
- `maxSizeMB`: 文件大小限制（MB），默认 50MB
  - 超过此大小的文件会被拒绝

### performance - 性能配置
```json
{
  "maxPointsPerFile": 2000,
  "showLabelsThreshold": 500,
  "iconCacheSize": 1000
}
```
- `maxPointsPerFile`: 单文件最大点位数，默认 2000
  - 限制单个文件可以包含的最大点位数量
  
- `showLabelsThreshold`: 显示标签阈值，默认 500
  - 当点位数量超过此值时，自动隐藏点位标签
  
- `iconCacheSize`: 图标缓存大小，默认 1000
  - 地图图标的最大缓存数量

### detection - 异常检测配置
```json
{
  "hrmsThreshold": 0.05,
  "vrmsThreshold": 0.05,
  "duplicateCoordinateTolerance": 0.001,
  "isolatedPointRangeMultiplier": 10
}
```
- `hrmsThreshold`: 水平精度阈值（米），默认 0.05m
  - 水平 RMS 超过此值的点位会被标记为精度异常
  
- `vrmsThreshold`: 垂直精度阈值（米），默认 0.05m
  - 垂直 RMS 超过此值的点位会被标记为精度异常
  
- `duplicateCoordinateTolerance`: 重复坐标容差（米），默认 0.001m = 1mm
  - 两个点位坐标差异小于此值时，被认为是重复坐标
  
- `isolatedPointRangeMultiplier`: 孤立点范围倍数，默认 10
  - 孤立点检测的范围倍数
  - 计算方式：先计算所有点位的平均距离，然后乘以此倍数
  - 距离其他点超过（平均距离 × 倍数）的点位会被标记为孤立点
  - 值越大，检测越宽松（更少的点被标记为孤立点）

### recycleBin - 回收站配置
```json
{
  "maxCapacity": 10000
}
```
- `maxCapacity`: 回收站最大容量，默认 10000 项
  - 回收站可以保存的最大项目数（文件 + 点位）
  - 超过此数量后，最早删除的项目会被自动清理

### search - 搜索配置
```json
{
  "debounceDelay": 300
}
```
- `debounceDelay`: 搜索防抖延迟（毫秒），默认 300ms
  - 用户停止输入后多久才执行搜索
  - 避免频繁的搜索请求（特别是地名搜索需要调用 API）

### ui - UI 配置
```json
{
  "messageDisplayDuration": 3000
}
```
- `messageDisplayDuration`: 消息提示显示时长（毫秒），默认 3000ms
  - 成功、错误、警告等提示消息的默认显示时间
  - 用户可以手动关闭消息，不受此限制
