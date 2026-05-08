/**
 * 天地图地名搜索服务
 */

// POI搜索结果
export interface TiandituPOI {
  name: string;
  address: string;
  lonlat: string; // "经度,纬度"
  phone?: string;
  hotPointID: string;
  province?: string;
  city?: string;
  county?: string;
  typeCode?: string;
  typeName?: string;
  distance?: string; // 距离（周边搜索返回，单位 m 或 km）
}

// 行政区结果
export interface TiandituArea {
  name: string;
  lonlat: string;
  bound: string;
  adminCode: number;
  level: number;
}

// 搜索响应
export interface TiandituSearchResponse {
  status: {
    infocode: number;
    cndesc: string;
  };
  resultType: number; // 1:POI 2:统计 3:行政区 5:线路
  count: number;
  pois?: TiandituPOI[];
  area?: TiandituArea[];
  prompt?: {
    type: number;
    admins: Array<{
      adminName: string;
      adminCode: string;
    }>;
    keyword: string;
  };
}

class TiandituSearchService {
  private baseUrl = 'https://api.tianditu.gov.cn/v2/search';
  private timeout = 10000; // 10秒超时

  /**
   * 通用请求方法（带超时和错误处理）
   */
  private async request(url: string): Promise<TiandituSearchResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`天地图搜索失败: ${response.statusText}`);
      }

      let data: TiandituSearchResponse;
      try {
        data = await response.json();
      } catch {
        throw new Error('天地图返回数据格式异常');
      }

      // 检查返回状态
      if (data.status?.infocode !== 1000) {
        throw new Error(data.status?.cndesc || '搜索失败');
      }

      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('天地图搜索超时，请检查网络', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 地名搜索（queryType=7）
   */
  async searchPlace(
    keyword: string,
    token: string,
    mapBounds: { minX: number; minY: number; maxX: number; maxY: number },
    level: number,
    options?: {
      start?: number;
      count?: number;
      specify?: string; // 指定行政区
    }
  ): Promise<TiandituSearchResponse> {
    const postStr = {
      keyWord: keyword,
      level: level.toString(),
      mapBound: `${mapBounds.minX},${mapBounds.minY},${mapBounds.maxX},${mapBounds.maxY}`,
      queryType: '7', // 7:地名搜索
      start: options?.start?.toString() || '0',
      count: options?.count?.toString() || '10',
      ...(options?.specify && { specify: options.specify }),
    };

    const url = `${this.baseUrl}?postStr=${encodeURIComponent(JSON.stringify(postStr))}&type=query&tk=${token}`;
    return this.request(url);
  }

  /**
   * 周边搜索（queryType=3）
   */
  async searchNearby(
    keyword: string,
    token: string,
    center: { lng: number; lat: number },
    radius: number, // 搜索半径（米，10公里内）
    options?: {
      start?: number;
      count?: number;
    }
  ): Promise<TiandituSearchResponse> {
    const postStr = {
      keyWord: keyword,
      queryType: '3', // 3:周边搜索
      pointLonlat: `${center.lng},${center.lat}`, // 中心点坐标
      queryRadius: radius.toString(), // 查询半径（米）
      start: options?.start?.toString() || '0',
      count: options?.count?.toString() || '20',
    };

    const url = `${this.baseUrl}?postStr=${encodeURIComponent(JSON.stringify(postStr))}&type=query&tk=${token}`;
    return this.request(url);
  }

  /**
   * 解析经纬度字符串
   */
  parseCoordinate(lonlat: string): { lng: number; lat: number } | null {
    const parts = lonlat.split(',');
    if (parts.length !== 2) return null;
    
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    
    if (isNaN(lng) || isNaN(lat)) return null;
    
    return { lng, lat };
  }
}

export const tiandituSearchService = new TiandituSearchService();
