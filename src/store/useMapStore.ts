import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LatLng } from '../types';

interface MapStore {
  // 当前显示的文件
  currentFileId: string | null;
  setCurrentFileId: (id: string | null) => void;

  // 地图视图
  center: LatLng;
  zoom: number;
  setView: (center: LatLng, zoom: number) => void;

  // 地图边界
  mapBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  setMapBounds: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;

  // 用户当前位置
  userLocation: LatLng | null;
  userLocationAccuracy: number | null;
  locationPermissionDenied: boolean;
  setUserLocation: (location: LatLng | null, accuracy?: number | null) => void;
  setLocationPermissionDenied: (denied: boolean) => void;

  // 触发 Fit to View
  fitToViewTrigger: number;
  triggerFitToView: () => void;

  // 选中的点
  selectedPointId: string | null;
  setSelectedPointId: (id: string | null) => void;

  // 搜索标记
  searchMarker: { lat: number; lng: number; name: string; address?: string } | null;
  setSearchMarker: (marker: { lat: number; lng: number; name: string; address?: string } | null) => void;

  // 测量工具状态
  measureMode: boolean;
  measurePoints: string[];
  setMeasureMode: (enabled: boolean) => void;
  addMeasurePoint: (pointId: string) => void;
  clearMeasurePoints: () => void;

  // 底图模式
  baseMapMode: 'map' | 'grid';
  setBaseMapMode: (mode: 'map' | 'grid') => void;
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      // 初始状态
      currentFileId: null,
      center: { lat: 39.9, lng: 116.4 }, // 北京（默认）
      zoom: 15, // 增加默认缩放级别
      mapBounds: null,
      userLocation: null,
      userLocationAccuracy: null,
      locationPermissionDenied: false,
      fitToViewTrigger: 0,
      selectedPointId: null,
      searchMarker: null,
      measureMode: false,
      measurePoints: [],
      baseMapMode: 'map', // 默认使用地图模式

      // Actions
      setCurrentFileId: (id) => set({ currentFileId: id }),
      setView: (center, zoom) => set({ center, zoom }),
      setMapBounds: (bounds) => set({ mapBounds: bounds }),
      setUserLocation: (location, accuracy = null) => set({ userLocation: location, userLocationAccuracy: accuracy }),
      setLocationPermissionDenied: (denied) => set({ locationPermissionDenied: denied }),
      triggerFitToView: () => set((state) => ({ fitToViewTrigger: state.fitToViewTrigger + 1 })),
      setSelectedPointId: (id) => set({ selectedPointId: id }),
      setSearchMarker: (marker) => set({ searchMarker: marker }),
      setMeasureMode: (enabled) =>
        set({ measureMode: enabled, measurePoints: enabled ? [] : [] }),
      addMeasurePoint: (pointId) =>
        set((state) => ({
          measurePoints: [...state.measurePoints, pointId],
        })),
      clearMeasurePoints: () => set({ measurePoints: [] }),
      setBaseMapMode: (mode) => set({ baseMapMode: mode }),
    }),
    {
      name: 'mappin-map-storage',
      // 只持久化底图模式
      partialize: (state) => ({ baseMapMode: state.baseMapMode }),
    }
  )
);
