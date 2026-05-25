import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoordinateSystem, BaseMapType, ProjectionType } from '../types';
import { appConfig } from '../config/appConfig';

interface SettingsStore {
  coordinateSystem: CoordinateSystem;
  setCoordinateSystem: (system: CoordinateSystem) => void;

  projectionType: ProjectionType;
  setProjectionType: (type: ProjectionType) => void;

  centralMeridian: number;
  setCentralMeridian: (meridian: number) => void;

  baseMap: BaseMapType;
  setBaseMap: (map: BaseMapType) => void;

  // 地图瓦片源
  mapTileSource: 'osm' | 'tianditu-vec' | 'tianditu-img' | 'tianditu-ter';
  setMapTileSource: (source: 'osm' | 'tianditu-vec' | 'tianditu-img' | 'tianditu-ter') => void;

  apiKeys: {
    tianditu?: string;
    amap?: string;
  };
  setApiKey: (service: 'tianditu' | 'amap', key: string) => void;

  language: 'zh-CN';
  setLanguage: (lang: 'zh-CN') => void;

  // 地图显示设置
  showUserLocation: boolean;
  setShowUserLocation: (show: boolean) => void;

  autoLocate: boolean;
  setAutoLocate: (auto: boolean) => void;

  showPointLabels: boolean;
  setShowPointLabels: (show: boolean) => void;

  // 异常检测阈值
  hrmsThreshold: number;
  setHrmsThreshold: (threshold: number) => void;

  vrmsThreshold: number;
  setVrmsThreshold: (threshold: number) => void;

  duplicateCoordinateTolerance: number;
  setDuplicateCoordinateTolerance: (tolerance: number) => void;

  isolatedPointRangeMultiplier: number;
  setIsolatedPointRangeMultiplier: (multiplier: number) => void;

  // 文件限制
  maxPointsPerFile: number;
  setMaxPointsPerFile: (max: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      coordinateSystem: appConfig.coordinate.defaultSystem as CoordinateSystem,
      projectionType: appConfig.coordinate.defaultProjection as ProjectionType,
      centralMeridian: appConfig.coordinate.defaultCentralMeridian,
      baseMap: 'osm',
      mapTileSource: appConfig.map.defaultTileSource as 'osm' | 'tianditu-vec' | 'tianditu-img' | 'tianditu-ter',
      apiKeys: {},
      language: 'zh-CN',
      showUserLocation: true,
      autoLocate: true,
      showPointLabels: false,
      hrmsThreshold: appConfig.detection.hrmsThreshold,
      vrmsThreshold: appConfig.detection.vrmsThreshold,
      duplicateCoordinateTolerance: appConfig.detection.duplicateCoordinateTolerance,
      isolatedPointRangeMultiplier: appConfig.detection.isolatedPointRangeMultiplier,
      maxPointsPerFile: appConfig.performance.maxPointsPerFile,

      setCoordinateSystem: (system) => set({ coordinateSystem: system }),
      setProjectionType: (type) => set({ projectionType: type }),
      setCentralMeridian: (meridian) => set({ centralMeridian: meridian }),
      setBaseMap: (map) => set({ baseMap: map }),
      setMapTileSource: (source) => set({ mapTileSource: source }),
      setApiKey: (service, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [service]: key },
        })),
      setLanguage: (lang) => set({ language: lang }),
      setShowUserLocation: (show) => set({ showUserLocation: show }),
      setAutoLocate: (auto) => set({ autoLocate: auto }),
      setShowPointLabels: (show) => set({ showPointLabels: show }),
      setHrmsThreshold: (threshold) => set({ hrmsThreshold: threshold }),
      setVrmsThreshold: (threshold) => set({ vrmsThreshold: threshold }),
      setDuplicateCoordinateTolerance: (tolerance) => set({ duplicateCoordinateTolerance: tolerance }),
      setIsolatedPointRangeMultiplier: (multiplier) => set({ isolatedPointRangeMultiplier: multiplier }),
      setMaxPointsPerFile: (max) => set({ maxPointsPerFile: max }),
    }),
    {
      name: 'mappin-settings',
    }
  )
);
