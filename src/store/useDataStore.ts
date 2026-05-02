import { create } from 'zustand';
import type { MeasurementFile, MeasurementPoint, RecycleBinItem } from '../types';
import { dataService } from '../services/dataService';
import { message } from 'antd';
import { useSettingsStore } from './useSettingsStore';

interface DataStore {
  files: MeasurementFile[];
  points: Map<string, MeasurementPoint[]>;
  loading: boolean;

  // 文件操作
  loadFiles: () => Promise<void>;
  loadPoints: (fileId: string) => Promise<void>;
  addFile: (file: MeasurementFile, points: MeasurementPoint[]) => Promise<void>;
  updateFile: (id: string, updates: Partial<MeasurementFile>) => Promise<void>;
  deleteFile: (id: string, moveToRecycleBin?: boolean) => Promise<void>;

  // 测量点操作
  addPoint: (fileId: string, point: MeasurementPoint) => Promise<void>;
  updatePoint: (
    fileId: string,
    pointId: string,
    data: Partial<MeasurementPoint>
  ) => Promise<void>;
  deletePoint: (fileId: string, pointId: string, moveToRecycleBin?: boolean) => Promise<void>;

  // 回收站操作
  loadRecycleBin: () => Promise<RecycleBinItem[]>;
  restoreFromRecycleBin: (itemIds: string[]) => Promise<{ 
    success: number; 
    conflicts: Array<{ pointNumber: string; newPointNumber: string }> 
  }>;
  deleteFromRecycleBin: (itemId: string) => Promise<void>;
  clearRecycleBin: () => Promise<void>;
}

export const useDataStore = create<DataStore>((set) => ({
  files: [],
  points: new Map(),
  loading: false,

  loadFiles: async () => {
    set({ loading: true });
    try {
      const files = await dataService.getAllFiles();
      set({ files });
    } finally {
      set({ loading: false });
    }
  },

  loadPoints: async (fileId: string) => {
    const points = await dataService.getPoints(fileId);
    
    // 检查点位数量是否超过限制
    const maxPointsPerFile = useSettingsStore.getState().maxPointsPerFile;
    if (points.length > maxPointsPerFile) {
      message.error(`文件点位数量（${points.length}）超过限制（${maxPointsPerFile}），无法加载。请在全局设置中调整限制。`);
      throw new Error(`点位数量超过限制：${points.length} > ${maxPointsPerFile}`);
    }
    
    set((state) => {
      const newPoints = new Map(state.points);
      newPoints.set(fileId, points);
      return { points: newPoints };
    });
  },

  addFile: async (file: MeasurementFile, points: MeasurementPoint[]) => {
    await dataService.saveFile(file);

    // 批量保存测量点（一次性写入，保持顺序）
    await dataService.savePoints(points);

    set((state) => {
      const newPoints = new Map(state.points);
      newPoints.set(file.id, points);
      return {
        files: [...state.files, file],
        points: newPoints,
      };
    });
  },

  updateFile: async (id: string, updates: Partial<MeasurementFile>) => {
    await dataService.updateFile(id, updates);
    
    set((state) => ({
      files: state.files.map((f) => 
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  deleteFile: async (id: string, moveToRecycleBin = true) => {
    if (moveToRecycleBin) {
      // 移动到回收站
      const file = await dataService.getFile(id);
      if (file) {
        const recycleBinItem: RecycleBinItem = {
          id: `file_${id}_${Date.now()}`,
          type: 'file',
          deletedTime: Date.now(),
          sourceFileId: id,
          data: file,
        };
        await dataService.moveToRecycleBin(recycleBinItem);
        
        // 同时移动所有点位到回收站
        const points = await dataService.getPoints(id);
        for (const point of points) {
          const pointItem: RecycleBinItem = {
            id: `point_${point.id}_${Date.now()}`,
            type: 'point',
            deletedTime: Date.now(),
            sourceFileId: id,
            data: point,
          };
          await dataService.moveToRecycleBin(pointItem);
        }
      }
    }
    
    // 从数据库删除
    await dataService.deleteFile(id);
    
    set((state) => {
      const newPoints = new Map(state.points);
      newPoints.delete(id);
      return {
        files: state.files.filter((f) => f.id !== id),
        points: newPoints,
      };
    });
  },

  updatePoint: async (
    fileId: string,
    pointId: string,
    data: Partial<MeasurementPoint>
  ) => {
    await dataService.updatePoint(fileId, pointId, data);

    set((state) => {
      const newPoints = new Map(state.points);
      const filePoints = newPoints.get(fileId);
      if (filePoints) {
        const updatedPoints = filePoints.map((p) =>
          p.id === pointId ? { ...p, ...data } : p
        );
        newPoints.set(fileId, updatedPoints);
      }
      return { points: newPoints };
    });
  },

  addPoint: async (fileId: string, point: MeasurementPoint) => {
    await dataService.savePoint(fileId, point);

    set((state) => {
      const newPoints = new Map(state.points);
      const filePoints = newPoints.get(fileId) || [];
      newPoints.set(fileId, [...filePoints, point]);
      return { points: newPoints };
    });
  },

  deletePoint: async (fileId: string, pointId: string, moveToRecycleBin = true) => {
    if (moveToRecycleBin) {
      // 移动到回收站
      const points = await dataService.getPoints(fileId);
      const point = points.find(p => p.id === pointId);
      if (point) {
        const recycleBinItem: RecycleBinItem = {
          id: `point_${pointId}_${Date.now()}`,
          type: 'point',
          deletedTime: Date.now(),
          sourceFileId: fileId,
          data: point,
        };
        await dataService.moveToRecycleBin(recycleBinItem);
      }
    }
    
    // 从数据库删除
    await dataService.deletePoint(fileId, pointId);

    set((state) => {
      const newPoints = new Map(state.points);
      const filePoints = newPoints.get(fileId);
      if (filePoints) {
        newPoints.set(
          fileId,
          filePoints.filter((p) => p.id !== pointId)
        );
      }
      return { points: newPoints };
    });
  },

  // 回收站操作
  loadRecycleBin: async () => {
    return await dataService.getRecycleBinItems();
  },

  restoreFromRecycleBin: async (itemIds: string[]) => {
    const items = await dataService.getRecycleBinItems();
    const toRestore = items.filter(item => itemIds.includes(item.id));
    
    let successCount = 0;
    const conflicts: Array<{ pointNumber: string; newPointNumber: string }> = [];
    
    for (const item of toRestore) {
      if (item.type === 'file') {
        // 恢复文件
        const file = item.data as MeasurementFile;
        await dataService.saveFile(file);
        await dataService.restoreFromRecycleBin(item.id);
        successCount++;
        
        // 重新加载文件列表
        const files = await dataService.getAllFiles();
        set({ files });
      } else {
        // 恢复点位 - 需要检查冲突
        const point = item.data as MeasurementPoint;
        const fileId = item.sourceFileId;
        
        // 检查文件是否存在
        const file = await dataService.getFile(fileId);
        if (!file) {
          continue; // 文件不存在，跳过
        }
        
        // 获取现有点位，检查点号冲突
        const existingPoints = await dataService.getPoints(fileId);
        const existingPointNumbers = new Set(existingPoints.map(p => p.pointNumber));
        
        let newPointNumber = point.pointNumber;
        let suffix = 1;
        
        while (existingPointNumbers.has(newPointNumber)) {
          newPointNumber = `${point.pointNumber}_恢复${suffix}`;
          suffix++;
        }
        
        // 如果点号被修改，记录冲突
        if (newPointNumber !== point.pointNumber) {
          conflicts.push({
            pointNumber: point.pointNumber,
            newPointNumber: newPointNumber,
          });
        }
        
        // 恢复点位（使用新点号，但保留原始点号）
        const restoredPoint = { 
          ...point, 
          pointNumber: newPointNumber,
          // 保留原始点号，如果没有则使用当前点号
          originalPointNumber: point.originalPointNumber || point.pointNumber
        };
        await dataService.savePoint(fileId, restoredPoint);
        await dataService.restoreFromRecycleBin(item.id);
        successCount++;
        
        // 更新 store 中的点位
        await useDataStore.getState().loadPoints(fileId);
      }
    }
    
    return { success: successCount, conflicts };
  },

  deleteFromRecycleBin: async (itemId: string) => {
    await dataService.deleteFromRecycleBin(itemId);
  },

  clearRecycleBin: async () => {
    await dataService.clearRecycleBin();
  },
}));
