import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useDataStore } from '../store/useDataStore';
import { isValidPointNumber } from '../utils/sanitize';
import type { MeasurementPoint } from '../types/measurement';

/**
 * 点位重命名 Hook
 * 统一处理点位重命名的逻辑
 */
export function usePointRename(currentFileId: string | null) {
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingPoint, setRenamingPoint] = useState<MeasurementPoint | null>(null);
  const [newPointNumber, setNewPointNumber] = useState('');

  const points = useDataStore((state) => state.points);
  const updatePoint = useDataStore((state) => state.updatePoint);

  // 打开重命名对话框
  const openRenameModal = useCallback((point: MeasurementPoint) => {
    setRenamingPoint(point);
    setNewPointNumber(point.pointNumber);
    setRenameModalOpen(true);
  }, []);

  // 关闭重命名对话框
  const closeRenameModal = useCallback(() => {
    setRenameModalOpen(false);
    setRenamingPoint(null);
    setNewPointNumber('');
  }, []);

  // 确认重命名
  const confirmRename = useCallback(async () => {
    if (!currentFileId || !renamingPoint) return;

    const trimmedName = newPointNumber.trim();
    if (!trimmedName) {
      message.error('点号不能为空');
      return;
    }

    // 验证点号格式
    if (!isValidPointNumber(trimmedName)) {
      message.error('点号格式不正确，只允许字母、数字、中文、下划线和连字符');
      return;
    }

    // 如果点号没有变化，直接关闭
    if (trimmedName === renamingPoint.pointNumber) {
      closeRenameModal();
      return;
    }

    // 检查点号是否重复
    const currentPoints = points.get(currentFileId) || [];
    const existingPoint = currentPoints.find(
      (p) => p.pointNumber === trimmedName && p.id !== renamingPoint.id
    );

    if (existingPoint) {
      message.error(`点号 ${trimmedName} 已存在`);
      return;
    }

    try {
      await updatePoint(currentFileId, renamingPoint.id, { pointNumber: trimmedName });
      message.success(`已将点号 ${renamingPoint.pointNumber} 重命名为 ${trimmedName}`);
      closeRenameModal();
    } catch {
      message.error('重命名失败');
    }
  }, [currentFileId, renamingPoint, newPointNumber, points, updatePoint, closeRenameModal]);

  return {
    renameModalOpen,
    renamingPoint,
    newPointNumber,
    setNewPointNumber,
    openRenameModal,
    closeRenameModal,
    confirmRename,
  };
}
