// 测量点质量参数
export interface QualityParameters {
  hrms?: number;
  vrms?: number;
  status?: string;
  sats?: number;
  date?: string;
  time?: string;
  [key: string]: string | number | undefined; // 支持其他参数
}

// 测量点类型
export type PointType = 'control' | 'survey';

// 测量点
export interface MeasurementPoint {
  id: string;
  fileId: string;
  pointNumber: string;
  originalPointNumber: string; // 原始点号，不随重命名改变
  x: number;
  y: number;
  z: number;
  type: PointType;
  order: number; // 原始文件中的顺序
  lat?: number; // 转换后的经纬度
  lng?: number;
  qualityParams?: QualityParameters;
  isManuallyAdded?: boolean; // 标记是否为手动添加的点
}

// 文件格式
export type FileFormat = 'simple' | 'detailed';

// 坐标系统
export type CoordinateSystem = 'CGCS2000' | 'Beijing54' | 'Xian80' | 'WGS84';

// 投影类型
export type ProjectionType = 'gauss-3' | 'gauss-6';

// 投影配置
export interface ProjectionConfig {
  coordinateSystem: CoordinateSystem;
  projectionType: ProjectionType;
  centralMeridian: number;
}

// 测量文件
export interface MeasurementFile {
  id: string;
  name: string;
  uploadTime: number;
  format: FileFormat;
  coordinateSystem: CoordinateSystem;
  pointCount: number;
  controlPointCount: number;
  surveyPointCount: number;
  projectionConfig: ProjectionConfig; // 文件的投影配置
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

// 回收站项目类型
export type RecycleBinItemType = 'file' | 'point';

// 回收站项目
export interface RecycleBinItem {
  id: string;
  type: RecycleBinItemType;
  deletedTime: number;
  sourceFileId: string;
  data: MeasurementFile | MeasurementPoint;
}
