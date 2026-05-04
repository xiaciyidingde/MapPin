import { db } from '../db/schema';
import type {
  MeasurementFile,
  MeasurementPoint,
  RecycleBinItem,
} from '../types';
import { errorHandler } from './errorHandler';

// 数据服务抽象接口
export interface IDataService {
  // 文件操作
  saveFile(file: MeasurementFile): Promise<string>;
  updateFile(id: string, updates: Partial<MeasurementFile>): Promise<void>;
  getFile(id: string): Promise<MeasurementFile | null>;
  getAllFiles(): Promise<MeasurementFile[]>;
  deleteFile(id: string): Promise<void>;

  // 测量点操作
  savePoint(
    fileId: string,
    point: MeasurementPoint
  ): Promise<string>;
  updatePoint(
    fileId: string,
    pointId: string,
    point: Partial<MeasurementPoint>
  ): Promise<void>;
  deletePoint(fileId: string, pointId: string): Promise<void>;
  getPoints(fileId: string): Promise<MeasurementPoint[]>;

  // 回收站操作
  moveToRecycleBin(item: RecycleBinItem): Promise<void>;
  restoreFromRecycleBin(itemId: string): Promise<void>;
  deleteFromRecycleBin(itemId: string): Promise<void>;
  getRecycleBinItems(): Promise<RecycleBinItem[]>;
  clearRecycleBin(): Promise<void>;
}

// 本地数据服务实现
export class LocalDataService implements IDataService {
  /**
   * 错误处理包装器
   */
  private async handleOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const appError = errorHandler.handleDatabaseError(
        error instanceof Error ? error : new Error('未知错误'),
        operationName
      );
      errorHandler.logError(appError);
      throw appError;
    }
  }

  // 文件操作
  async saveFile(file: MeasurementFile): Promise<string> {
    return this.handleOperation(async () => {
      await db.files.put(file);
      return file.id;
    }, '保存文件');
  }

  async updateFile(id: string, updates: Partial<MeasurementFile>): Promise<void> {
    return this.handleOperation(async () => {
      await db.files.update(id, updates);
    }, '更新文件');
  }

  async getFile(id: string): Promise<MeasurementFile | null> {
    return this.handleOperation(async () => {
      const file = await db.files.get(id);
      return file || null;
    }, '获取文件');
  }

  async getAllFiles(): Promise<MeasurementFile[]> {
    return this.handleOperation(async () => {
      return await db.files.orderBy('uploadTime').reverse().toArray();
    }, '获取文件列表');
  }

  async deleteFile(id: string): Promise<void> {
    return this.handleOperation(async () => {
      await db.transaction('rw', [db.files, db.points], async () => {
        await db.files.delete(id);
        await db.points.where('fileId').equals(id).delete();
      });
    }, '删除文件');
  }

  // 测量点操作
  async savePoint(
    _fileId: string,
    point: MeasurementPoint
  ): Promise<string> {
    return this.handleOperation(async () => {
      await db.points.put(point);
      return point.id;
    }, '保存测量点');
  }

  // 批量保存测量点
  async savePoints(points: MeasurementPoint[]): Promise<void> {
    return this.handleOperation(async () => {
      await db.points.bulkPut(points);
    }, '批量保存测量点');
  }

  async updatePoint(
    _fileId: string,
    pointId: string,
    point: Partial<MeasurementPoint>
  ): Promise<void> {
    return this.handleOperation(async () => {
      await db.points.update(pointId, point);
    }, '更新测量点');
  }

  // 批量更新测量点
  async bulkUpdatePoints(
    updates: Array<{ pointId: string; data: Partial<MeasurementPoint> }>
  ): Promise<void> {
    return this.handleOperation(async () => {
      await db.transaction('rw', db.points, async () => {
        for (const { pointId, data } of updates) {
          await db.points.update(pointId, data);
        }
      });
    }, '批量更新测量点');
  }

  async deletePoint(_fileId: string, pointId: string): Promise<void> {
    return this.handleOperation(async () => {
      await db.points.delete(pointId);
    }, '删除测量点');
  }

  async getPoints(fileId: string): Promise<MeasurementPoint[]> {
    return this.handleOperation(async () => {
      return await db.points.where('fileId').equals(fileId).sortBy('order');
    }, '获取测量点列表');
  }

  // 回收站操作
  async moveToRecycleBin(item: RecycleBinItem): Promise<void> {
    return this.handleOperation(async () => {
      await db.recycleBin.put(item);

      // 检查回收站容量限制（10000项）
      const count = await db.recycleBin.count();
      if (count > 10000) {
        // 删除最早的项目
        const oldestItems = await db.recycleBin
          .orderBy('deletedTime')
          .limit(count - 10000)
          .toArray();
        const idsToDelete = oldestItems.map((item) => item.id);
        await db.recycleBin.bulkDelete(idsToDelete);
      }
    }, '移到回收站');
  }

  async restoreFromRecycleBin(itemId: string): Promise<void> {
    return this.handleOperation(async () => {
      const item = await db.recycleBin.get(itemId);
      if (!item) {
        throw new Error('回收站项目不存在');
      }

      await db.transaction('rw', [db.files, db.points, db.recycleBin], async () => {
        if (item.type === 'file') {
          const file = item.data as MeasurementFile;
          await db.files.put(file);
        } else {
          const point = item.data as MeasurementPoint;
          await db.points.put(point);
        }
        await db.recycleBin.delete(itemId);
      });
    }, '从回收站恢复');
  }

  async getRecycleBinItems(): Promise<RecycleBinItem[]> {
    return this.handleOperation(async () => {
      return await db.recycleBin.orderBy('deletedTime').reverse().toArray();
    }, '获取回收站列表');
  }

  async deleteFromRecycleBin(itemId: string): Promise<void> {
    return this.handleOperation(async () => {
      await db.recycleBin.delete(itemId);
    }, '从回收站删除');
  }

  async clearRecycleBin(): Promise<void> {
    return this.handleOperation(async () => {
      await db.recycleBin.clear();
    }, '清空回收站');
  }
}

// 导出默认实例
export const dataService = new LocalDataService();
