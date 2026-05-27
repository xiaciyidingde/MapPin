import { useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';

/**
 * 生成下一个点位号的 Hook
 * @param fileId 文件 ID
 * @returns 下一个点位号（字符串）
 */
export function useNextPointNumber(fileId: string | null): string {
  const points = useDataStore((state) => state.points);
  
  return useMemo(() => {
    if (!fileId) return '1';
    
    const currentPoints = points.get(fileId) || [];
    if (currentPoints.length === 0) return '1';
    
    // 提取所有纯数字的点号
    const numericPointNumbers = currentPoints
      .map(p => p.pointNumber)
      .filter(num => /^\d+$/.test(num))
      .map(num => parseInt(num, 10));
    
    if (numericPointNumbers.length === 0) return '1';
    
    // 返回最大值 + 1
    const maxNumber = Math.max(...numericPointNumbers);
    return String(maxNumber + 1);
  }, [fileId, points]);
}
