import { useEffect } from 'react';
import { useDataStore, useMapStore } from '../store';

/**
 * 数据加载 Hook
 * 管理文件和点位数据的加载
 */
export function useDataLoader() {
  const loadFiles = useDataStore((state) => state.loadFiles);
  const loadPoints = useDataStore((state) => state.loadPoints);
  const currentFileId = useMapStore((state) => state.currentFileId);

  // 加载文件列表
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // 加载当前文件的点位数据
  useEffect(() => {
    if (currentFileId) {
      loadPoints(currentFileId);
    }
  }, [currentFileId, loadPoints]);

  return {
    currentFileId,
  };
}
