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
  const [newCode, setNewCode] = useState('');

  const points = useDataStore((state) => state.points);
  const updatePoint = useDataStore((state) => state.updatePoint);

  // 打开重命名对话框
  const openRenameModal = useCallback((point: MeasurementPoint) => {
    setRenamingPoint(point);
    setNewPointNumber(point.pointNumber);
    setNewCode(point.code || '');
    setRenameModalOpen(true);
  }, []);

  // 关闭重命名对话框
  const closeRenameModal = useCallback(() => {
    setRenameModalOpen(false);
    setRenamingPoint(null);
    setNewPointNumber('');
    setNewCode('');
  }, []);

  // 确认重命名
  const confirmRename = useCallback(async () => {
    if (!currentFileId || !renamingPoint) return;

    const trimmedName = newPointNumber.trim();
    const trimmedCode = newCode.trim();
    
    if (!trimmedName) {
      message.error('点号不能为空');
      return;
    }

    // 验证点号格式
    if (!isValidPointNumber(trimmedName)) {
      message.error('点号格式不正确，只允许字母、数字、中文、下划线和连字符');
      return;
    }

    // 如果点号和编码都没有变化，直接关闭
    if (trimmedName === renamingPoint.pointNumber && trimmedCode === (renamingPoint.code || '')) {
      closeRenameModal();
      return;
    }

    // 检查点号是否重复（仅当点号改变时）
    if (trimmedName !== renamingPoint.pointNumber) {
      const currentPoints = points.get(currentFileId) || [];
      const existingPoint = currentPoints.find(
        (p) => p.pointNumber === trimmedName && p.id !== renamingPoint.id
      );

      if (existingPoint) {
        message.error(`点号 ${trimmedName} 已存在`);
        return;
      }
    }

    try {
      const updates: Partial<MeasurementPoint> = {};
      
      if (trimmedName !== renamingPoint.pointNumber) {
        updates.pointNumber = trimmedName;
      }
      
      if (trimmedCode !== (renamingPoint.code || '')) {
        updates.code = trimmedCode || undefined;
      }
      
      await updatePoint(currentFileId, renamingPoint.id, updates);
      
      const messages: string[] = [];
      if (updates.pointNumber) {
        messages.push(`点号: ${renamingPoint.pointNumber} → ${trimmedName}`);
      }
      if ('code' in updates) {
        messages.push(`编码: ${renamingPoint.code || '无'} → ${trimmedCode || '无'}`);
      }
      
      message.success(`已更新 ${messages.join(', ')}`);
      closeRenameModal();
    } catch {
      message.error('重命名失败');
    }
  }, [currentFileId, renamingPoint, newPointNumber, newCode, points, updatePoint, closeRenameModal]);

  return {
    renameModalOpen,
    renamingPoint,
    newPointNumber,
    newCode,
    setNewPointNumber,
    setNewCode,
    openRenameModal,
    closeRenameModal,
    confirmRename,
  };
}
