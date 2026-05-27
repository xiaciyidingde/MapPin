import { useEffect } from 'react';
import { App } from 'antd';
import { useDataStore, useMapStore } from '../store';

/**
 * 数据加载 Hook
 * 管理文件和点位数据的加载
 */
export function useDataLoader() {
  const { message } = App.useApp();
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
      loadPoints(currentFileId).catch((error) => {
        // 处理点位数量超限错误
        if (error.message?.startsWith('POINTS_LIMIT_EXCEEDED:')) {
          const [, count, limit] = error.message.split(':');
          message.error(`文件点位数量（${count}）超过限制（${limit}），无法加载。请在全局设置中调整限制。`);
        } else {
          message.error('加载点位数据失败');
          console.error('Failed to load points:', error);
        }
      });
    }
  }, [currentFileId, loadPoints, message]);

  return {
    currentFileId,
  };
}
