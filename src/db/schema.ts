import Dexie, { type Table } from 'dexie';
import type {
  MeasurementFile,
  MeasurementPoint,
  RecycleBinItem,
  CoordinateSystem,
  ProjectionType,
} from '../types';
import { appConfig } from '../config/appConfig';

// 设置项
export interface Setting {
  key: string;
  value: string | number | boolean | object;
}

// MapPin 数据库
export class MapPinDatabase extends Dexie {
  files!: Table<MeasurementFile, string>;
  points!: Table<MeasurementPoint, string>;
  recycleBin!: Table<RecycleBinItem, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('MapPinDB');

    // 版本 1：初始版本
    this.version(1).stores({
      files: 'id, name, uploadTime',
      points: 'id, fileId, pointNumber, type, [fileId+pointNumber]',
      recycleBin: 'id, deletedTime, type, sourceFileId',
      settings: 'key',
    });

    // 版本 2：添加 projectionConfig 支持
    this.version(2).stores({
      files: 'id, name, uploadTime',
      points: 'id, fileId, pointNumber, type, [fileId+pointNumber]',
      recycleBin: 'id, deletedTime, type, sourceFileId',
      settings: 'key',
    }).upgrade((trans) => {
      // 为现有文件添加默认的 projectionConfig
      return trans.table('files').toCollection().modify((file: MeasurementFile) => {
        if (!file.projectionConfig) {
          file.projectionConfig = {
            coordinateSystem: (file.coordinateSystem || appConfig.coordinate.defaultSystem) as CoordinateSystem,
            projectionType: appConfig.coordinate.defaultProjection as ProjectionType,
            centralMeridian: appConfig.coordinate.defaultCentralMeridian,
          };
        }
      });
    });

    // 版本 3：添加 order 字段支持（开发阶段，不兼容旧数据）
    this.version(3).stores({
      files: 'id, name, uploadTime',
      points: 'id, fileId, pointNumber, type, order, [fileId+order]',
      recycleBin: 'id, deletedTime, type, sourceFileId',
      settings: 'key',
    });

    // 版本 4：添加 originalPointNumber 字段
    this.version(4).stores({
      files: 'id, name, uploadTime',
      points: 'id, fileId, pointNumber, originalPointNumber, type, order, [fileId+order]',
      recycleBin: 'id, deletedTime, type, sourceFileId',
      settings: 'key',
    });
  }
}

// 导出数据库实例
export const db = new MapPinDatabase();
