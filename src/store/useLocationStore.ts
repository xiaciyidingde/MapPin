/**
 * 定位状态管理
 * 管理定位模式、位置数据、轨迹记录等
 */

import { create } from 'zustand';
import type {
  Position,
  LocationMode,
  Track,
  TrackPoint,
} from '../types/location';

interface LocationState {
  // 当前位置
  currentPosition: Position | null;
  setCurrentPosition: (position: Position | null) => void;

  // 定位模式
  locationMode: LocationMode;
  setLocationMode: (mode: LocationMode) => void;

  // 可用的定位模式
  availableModes: LocationMode[];
  setAvailableModes: (modes: LocationMode[]) => void;

  // 定位状态
  isTracking: boolean;
  setIsTracking: (tracking: boolean) => void;

  // 定位错误
  locationError: string | null;
  setLocationError: (error: string | null) => void;

  // 轨迹记录
  currentTrack: Track | null;
  historicalTracks: Track[];
  startTrack: (name: string) => void;
  stopTrack: () => void;
  addTrackPoint: (position: Position) => void;
  clearTrack: () => void;
  deleteTrack: (trackId: string) => void;

  // 位置历史（用于显示轨迹）
  positionHistory: Position[];
  addPositionToHistory: (position: Position) => void;
  clearPositionHistory: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  // 初始状态
  currentPosition: null,
  locationMode: 'gps',
  availableModes: ['gps'],
  isTracking: false,
  locationError: null,
  currentTrack: null,
  historicalTracks: [],
  positionHistory: [],

  // Actions
  setCurrentPosition: (position) => {
    set({ currentPosition: position });

    // 如果正在记录轨迹，添加到轨迹中
    const { currentTrack, isTracking } = get();
    if (isTracking && currentTrack && position) {
      get().addTrackPoint(position);
    }

    // 添加到位置历史
    if (position) {
      get().addPositionToHistory(position);
    }
  },

  setLocationMode: (mode) => set({ locationMode: mode }),

  setAvailableModes: (modes) => set({ availableModes: modes }),

  setIsTracking: (tracking) => set({ isTracking: tracking }),

  setLocationError: (error) => set({ locationError: error }),

  // 轨迹管理
  startTrack: (name) => {
    const track: Track = {
      id: `track-${Date.now()}`,
      name,
      startTime: Date.now(),
      points: [],
    };
    set({ currentTrack: track, isTracking: true });
  },

  stopTrack: () => {
    const { currentTrack, historicalTracks } = get();
    if (currentTrack) {
      const finishedTrack: Track = {
        ...currentTrack,
        endTime: Date.now(),
        duration: Date.now() - currentTrack.startTime,
      };
      set({
        currentTrack: null,
        isTracking: false,
        historicalTracks: [...historicalTracks, finishedTrack],
      });
    }
  },

  addTrackPoint: (position) => {
    const { currentTrack } = get();
    if (!currentTrack) return;

    const trackPoint: TrackPoint = {
      ...position,
      id: `point-${Date.now()}`,
      trackId: currentTrack.id,
    };

    const updatedTrack: Track = {
      ...currentTrack,
      points: [...currentTrack.points, trackPoint],
    };

    set({ currentTrack: updatedTrack });
  },

  clearTrack: () => {
    set({ currentTrack: null, isTracking: false });
  },

  deleteTrack: (trackId) => {
    set((state) => ({
      historicalTracks: state.historicalTracks.filter((t) => t.id !== trackId),
    }));
  },

  // 位置历史管理
  addPositionToHistory: (position) => {
    set((state) => {
      const history = [...state.positionHistory, position];
      // 只保留最近 1000 个位置
      if (history.length > 1000) {
        history.shift();
      }
      return { positionHistory: history };
    });
  },

  clearPositionHistory: () => {
    set({ positionHistory: [] });
  },
}));
