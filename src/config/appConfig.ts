/**
 * 应用配置加载器
 * 从 public/app.config.json 动态加载配置
 */

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
  location: {
    timeout: number;
  };
  map: {
    defaultCenter: {
      lat: number;
      lng: number;
    };
    defaultZoom: number;
    locateZoomLevel: number;
    minZoom: number;
    maxZoom: number;
    defaultTileSource: string;
    disabledTileSources?: string[];
    tianDiTuTokens: string[];
  };
  file: {
    maxSizeMB: number;
  };
  performance: {
    maxPointsPerFile: number;
    showLabelsThreshold: number;
    iconCacheSize: number;
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
  };
  ui: {
    messageDisplayDuration: number;
  };
}

// 初始化阶段配置
const safeConfig: AppConfig = {
  app: { name: "MapPin", description: "" },
  author: { show: false, showLinks: false, links: [] },
  coordinate: {
    defaultSystem: "CGCS2000",
    defaultProjection: "gauss-3",
    defaultCentralMeridian: 114,
    centralMeridianRange: { min: 75, max: 135 }
  },
  location: {
    timeout: 10000
  },
  map: {
    defaultCenter: { lat: 39.9, lng: 116.4 },
    defaultZoom: 15,
    locateZoomLevel: 18,
    minZoom: 3,
    maxZoom: 25,
    defaultTileSource: "osm",
    disabledTileSources: [],
    tianDiTuTokens: []
  },
  file: {
    maxSizeMB: 50
  },
  performance: {
    maxPointsPerFile: 2000,
    showLabelsThreshold: 500,
    iconCacheSize: 1000
  },
  detection: {
    hrmsThreshold: 0.05,
    vrmsThreshold: 0.05,
    duplicateCoordinateTolerance: 0.001,
    isolatedPointRangeMultiplier: 10
  },
  recycleBin: { maxCapacity: 10000 },
  search: { debounceDelay: 300 },
  ui: { messageDisplayDuration: 3000 }
};

let cachedConfig: AppConfig | null = null;
let configLoadError: Error | null = null;

/**
 * 加载应用配置
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch('/app.config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    const config = await response.json();
    cachedConfig = config;
    configLoadError = null;
    return config;
  } catch (error) {
    configLoadError = error as Error;
    throw error;
  }
}

/**
 * 获取当前配置
 */
export function getAppConfig(): AppConfig {
  return cachedConfig || safeConfig;
}

/**
 * 检查配置是否已加载
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}

/**
 * 获取配置加载错误
 */
export function getConfigLoadError(): Error | null {
  return configLoadError;
}

// 导出配置对象（向后兼容）
export const appConfig = new Proxy({} as AppConfig, {
  get(_target, prop) {
    return getAppConfig()[prop as keyof AppConfig];
  }
});

