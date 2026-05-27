import { useCallback } from 'react';
import { App } from 'antd';
import { useDataStore } from '../store';

/**
 * 点位删除 Hook
 * 统一处理点位删除逻辑，包括错误处理和成功提示
 * 
 * @param fileId - 当前文件 ID
 * @returns handleDelete - 删除点位的函数
 */
export function usePointDelete(fileId: string | null) {
  const { message } = App.useApp();
  const deletePoint = useDataStore((state) => state.deletePoint);
  
  const handleDelete = useCallback(
    async (pointId: string, pointNumber: string) => {
      if (!fileId) return false;
      
      try {
        await deletePoint(fileId, pointId);
        message.success(`已删除点 ${pointNumber}`);
        return true;
      } catch {
        message.error('删除失败');
        return false;
      }
    },
    [fileId, deletePoint, message]
  );
  
  return { handleDelete };
}
