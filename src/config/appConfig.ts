/**
 * 应用配置加载器
 * 从根目录的 app.config.json 加载配置
 */

import appConfigJson from '../../app.config.json';

export interface LinkItem {
  title: string;
  url: string;
  description: string;
  favicon?: string;
  icon?: string;
}

export interface AppConfig {
  app: {
    name: string;
    description: string;
  };
  author: {
    show: boolean;
    showLinks: boolean;
    links: LinkItem[];
  };
  coordinate: {
    defaultSystem: string;
    defaultProjection: string;
    defaultCentralMeridian: number;
    centralMeridianRange: {
      min: number;
      max: number;
    };
  };
  map: {
    defaultCenter: {
      lat: number;
      lng: number;
    };
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    defaultTileSource: string;
    cluster: {
      radius: number;
      maxZoom: number;
    };
    tianDiTuTokens: string[];
  };
  file: {
    maxSizeMB: number;
    allowedTypes: string[];
    allowedExtensions: string;
  };
  performance: {
    largeFileThreshold: number;
    virtualScrollThreshold: number;
    maxPointsPerFile: number;
  };
  detection: {
    hrmsThreshold: number;
    vrmsThreshold: number;
    duplicateCoordinateTolerance: number;
    isolatedPointRangeMultiplier: number;
  };
  recycleBin: {
    maxCapacity: number;
  };
  search: {
    debounceDelay: number;
    minLength: number;
  };
}

// 导出配置对象
export const appConfig: AppConfig = appConfigJson as AppConfig;
