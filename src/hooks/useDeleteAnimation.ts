import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';

type AnimationType = 'slideOut' | 'scaleOut';

interface UseDeleteAnimationOptions {
  /**
   * 动画类型
   * - slideOut: 向右滑出并淡出
   * - scaleOut: 向中心缩小并淡出
   */
  type?: AnimationType;
  /**
   * 动画持续时间（毫秒）
   */
  duration?: number;
  /**
   * 删除延迟时间（毫秒）
   * - slideOut 默认 300ms（需要等待动画完成）
   * - scaleOut 默认 0ms（动画和删除同时进行）
   */
  delay?: number;
}

/**
 * 删除动画 Hook
 * 
 * @example
 * ```tsx
 * // 文件列表（滑出动画）
 * const { deletingIds, handleDelete, getAnimationStyle } = useDeleteAnimation({
 *   type: 'slideOut',
 * });
 * 
 * <Card style={getAnimationStyle(file.id)}>
 *   <Button onClick={() => handleDelete(file.id, async () => {
 *     await deleteFile(file.id);
 *   })} />
 * </Card>
 * 
 * // 点位卡片（缩小动画）
 * const { deletingIds, handleDelete, getAnimationStyle } = useDeleteAnimation({
 *   type: 'scaleOut',
 * });
 * 
 * <Card style={getAnimationStyle(point.id)}>
 *   <Button onClick={() => handleDelete(point.id, async () => {
 *     await deletePoint(point.id);
 *   })} />
 * </Card>
 * ```
 */
export function useDeleteAnimation(options: UseDeleteAnimationOptions = {}) {
  const {
    type = 'scaleOut',
    duration = type === 'slideOut' ? 300 : 200,
    delay = type === 'slideOut' ? 300 : 0,
  } = options;

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  /**
   * 处理删除操作
   * @param id 要删除的项目 ID
   * @param onDelete 删除回调函数
   */
  const handleDelete = useCallback(async (
    id: string,
    onDelete: () => void | Promise<void>
  ) => {
    // 触发删除动画
    setDeletingIds(prev => new Set(prev).add(id));

    // 如果有延迟，等待动画完成后再执行删除
    if (delay > 0) {
      setTimeout(async () => {
        await onDelete();
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, delay);
    } else {
      // 无延迟，动画和删除同时进行
      await onDelete();
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [delay]);

  /**
   * 获取动画样式
   * @param id 项目 ID
   * @returns CSS 样式对象
   */
  const getAnimationStyle = useCallback((id: string): CSSProperties => {
    const isDeleting = deletingIds.has(id);

    if (type === 'slideOut') {
      return {
        transform: isDeleting ? 'translateX(100%)' : 'translateX(0)',
        opacity: isDeleting ? 0 : 1,
        maxHeight: isDeleting ? 0 : '500px',
        marginBottom: isDeleting ? 0 : undefined,
        overflow: 'hidden',
        transition: `all ${duration}ms ease-out`,
      };
    }

    // scaleOut
    return {
      transform: isDeleting ? 'scale(0.8)' : 'scale(1)',
      opacity: isDeleting ? 0 : 1,
      transition: `all ${duration}ms ease-out`,
    };
  }, [deletingIds, type, duration]);

  return {
    deletingIds,
    handleDelete,
    getAnimationStyle,
  };
}
