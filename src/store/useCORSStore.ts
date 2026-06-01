/**
 * CORS RTK 状态管理
 * 管理 CORS 连接配置、状态、RTK 质量等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CORSConfig,
  NTRIPStatus,
  RTKStatus,
  SatelliteInfo,
} from '../types/location';

interface CORSState {
  // CORS 配置
  configs: CORSConfig[];
  currentConfig: CORSConfig | null;
  addConfig: (config: CORSConfig) => void;
  updateConfig: (id: string, config: Partial<CORSConfig>) => void;
  deleteConfig: (id: string) => void;
  setCurrentConfig: (config: CORSConfig | null) => void;

  // 连接状态
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;

  // NTRIP 状态
  ntripStatus: NTRIPStatus | null;
  setNTRIPStatus: (status: NTRIPStatus | null) => void;

  // RTK 状态
  rtkStatus: RTKStatus | null;
  setRTKStatus: (status: RTKStatus | null) => void;

  // 星历加载状态
  ephemerisLoading: boolean;
  ephemerisFailed: boolean;
  setEphemerisLoading: (loading: boolean) => void;
  setEphemerisFailed: (failed: boolean) => void;

  // 卫星信息
  satellites: SatelliteInfo[];
  setSatellites: (satellites: SatelliteInfo[]) => void;

  // 连接错误
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
}

export const useCORSStore = create<CORSState>()(
  persist(
    (set) => ({
      // 初始状态
      configs: [],
      currentConfig: null,
      connectionStatus: 'disconnected',
      ntripStatus: null,
      rtkStatus: null,
      satellites: [],
      connectionError: null,
      ephemerisLoading: false,
      ephemerisFailed: false,

      // CORS 配置管理
      addConfig: (config) => {
        const newConfig: CORSConfig = {
          ...config,
          id: config.id || `cors-${Date.now()}`,
          enabled: config.enabled ?? true,
        };
        set((state) => ({
          configs: [...state.configs, newConfig],
        }));
      },

      updateConfig: (id, updates) => {
        set((state) => ({
          configs: state.configs.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteConfig: (id) => {
        set((state) => ({
          configs: state.configs.filter((c) => c.id !== id),
          currentConfig: state.currentConfig?.id === id ? null : state.currentConfig,
        }));
      },

      setCurrentConfig: (config) => {
        set({ currentConfig: config });
      },

      // 状态管理
      setConnectionStatus: (status) => {
        set({ connectionStatus: status });
        // 连接成功时清除错误
        if (status === 'connected') {
          set({ connectionError: null });
        }
      },

      setNTRIPStatus: (status) => {
        set({ ntripStatus: status });
      },

      setRTKStatus: (status) => {
        set({ rtkStatus: status });
      },

      setSatellites: (satellites) => {
        set({ satellites });
      },

      setConnectionError: (error) => {
        set({ connectionError: error });
        if (error) {
          set({ connectionStatus: 'error' });
        }
      },

      setEphemerisLoading: (loading) => {
        console.log('[useCORSStore] setEphemerisLoading:', loading);
        set({ ephemerisLoading: loading });
        // 开始加载时清除失败状态
        if (loading) {
          set({ ephemerisFailed: false });
        }
      },

      setEphemerisFailed: (failed) => {
        console.log('[useCORSStore] setEphemerisFailed:', failed);
        set({ ephemerisFailed: failed });
        // 失败时停止加载状态
        if (failed) {
          set({ ephemerisLoading: false });
        }
      },
    }),
    {
      name: 'mappin-cors-storage',
      // 只持久化配置，不持久化状态
      partialize: (state) => ({
        configs: state.configs,
        currentConfig: state.currentConfig,
      }),
    }
  )
);
