import dayjs from 'dayjs';
import type { MeasurementFile } from '../types';

/**
 * 生成默认文件名
 * @param currentFileId 当前文件 ID
 * @param files 文件列表
 * @param prefix 文件名前缀（默认：导出文件）
 * @returns 生成的文件名（不含扩展名）
 */
export function generateDefaultFileName(
  currentFileId: string | null,
  files: MeasurementFile[],
  prefix: string = '导出文件'
): string {
  if (currentFileId) {
    const currentFile = files.find(f => f.id === currentFileId);
    if (currentFile) {
      return currentFile.name.replace(/\.dat$/i, '');
    }
  }
  return `${prefix}_${dayjs().format('YYYYMMDD')}`;
}
