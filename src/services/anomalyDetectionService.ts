import type { MeasurementPoint } from '../types';

// 异常类型
export type AnomalyType = 'precision' | 'isolated' | 'duplicate';

// 异常检测结果
export interface Anomaly {
  type: AnomalyType;
  pointId: string;
  pointNumber: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  details: {
    hrms?: number;
    vrms?: number;
    threshold?: number;
    nearestPoint?: string;
    distance?: number;
    duplicateWith?: string[];
    coordinates?: { x: number; y: number; z: number };
    [key: string]: unknown;
  };
}

// 异常检测配置
export interface AnomalyDetectionConfig {
  hrmsThreshold: number;
  vrmsThreshold: number;
  duplicateCoordinateTolerance: number;
  isolatedPointRangeMultiplier: number;
}

class AnomalyDetectionService {
  /**
   * 检测所有异常
   */
  detectAll(points: MeasurementPoint[], config: AnomalyDetectionConfig): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. 精度异常检测
    anomalies.push(...this.detectPrecisionAnomalies(points, config));

    // 2. 孤立点检测
    anomalies.push(...this.detectIsolatedPoints(points, config));

    // 3. 重复坐标检测
    anomalies.push(...this.detectDuplicateCoordinates(points, config));

    return anomalies;
  }

  /**
   * 检测精度异常
   */
  private detectPrecisionAnomalies(
    points: MeasurementPoint[],
    config: AnomalyDetectionConfig
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const point of points) {
      if (!point.qualityParams) continue;

      const hrms = this.getNumericValue(point.qualityParams.hrms);
      const vrms = this.getNumericValue(point.qualityParams.vrms);

      // 检测水平精度
      if (hrms !== null && hrms > config.hrmsThreshold) {
        const exceedRatio = (hrms / config.hrmsThreshold).toFixed(1);
        anomalies.push({
          type: 'precision',
          pointId: point.id,
          pointNumber: point.pointNumber,
          severity: hrms > config.hrmsThreshold * 2 ? 'high' : 'medium',
          message: `水平精度超标 ${exceedRatio}倍`,
          details: {
            hrms,
            threshold: config.hrmsThreshold,
            exceedBy: hrms - config.hrmsThreshold,
          },
        });
      }

      // 检测垂直精度
      if (vrms !== null && vrms > config.vrmsThreshold) {
        const exceedRatio = (vrms / config.vrmsThreshold).toFixed(1);
        anomalies.push({
          type: 'precision',
          pointId: point.id,
          pointNumber: point.pointNumber,
          severity: vrms > config.vrmsThreshold * 2 ? 'high' : 'medium',
          message: `垂直精度超标 ${exceedRatio}倍`,
          details: {
            vrms,
            threshold: config.vrmsThreshold,
            exceedBy: vrms - config.vrmsThreshold,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * 检测孤立点（基于最近邻距离，使用空间网格优化）
   */
  private detectIsolatedPoints(points: MeasurementPoint[], config: AnomalyDetectionConfig): Anomaly[] {
    if (points.length < 3) return []; // 点数太少无法判定

    const anomalies: Anomaly[] = [];

    // 计算边界框用于空间网格
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    // 计算合理的网格大小（基于点的平均密度）
    const area = (maxX - minX) * (maxY - minY);
    const avgDensity = points.length / area;
    const avgDistance = Math.sqrt(1 / avgDensity);
    const gridSize = Math.max(avgDistance * 5, 1); // 网格大小为平均距离的5倍
    
    // 使用空间网格加速最近点查找
    const spatialGrid = new Map<string, MeasurementPoint[]>();
    
    // 构建空间索引
    for (const point of points) {
      const gridX = Math.floor((point.x - minX) / gridSize);
      const gridY = Math.floor((point.y - minY) / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!spatialGrid.has(key)) {
        spatialGrid.set(key, []);
      }
      spatialGrid.get(key)!.push(point);
    }
    
    // 查找最近点的优化函数
    const findNearestPoint = (point: MeasurementPoint): { distance: number; pointNumber: string } => {
      const gridX = Math.floor((point.x - minX) / gridSize);
      const gridY = Math.floor((point.y - minY) / gridSize);
      
      let minDistance = Infinity;
      let nearestPointNumber = '';
      
      // 扩大搜索范围，确保能找到最近点
      const searchRadius = 3; // 搜索周围 3x3 = 9 个网格
      
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          const key = `${gridX + dx},${gridY + dy}`;
          const gridPoints = spatialGrid.get(key) || [];
          
          for (const other of gridPoints) {
            if (point.id === other.id) continue;
            const distance = this.calculateDistance(point, other);
            if (distance < minDistance) {
              minDistance = distance;
              nearestPointNumber = other.pointNumber;
            }
          }
        }
      }
      
      return { distance: minDistance, pointNumber: nearestPointNumber };
    };
    
    // 1. 计算所有点的最近邻距离
    const nearestDistances: number[] = [];
    const nearestPointNumbers: string[] = [];
    
    for (const point of points) {
      const { distance, pointNumber } = findNearestPoint(point);
      nearestDistances.push(distance);
      nearestPointNumbers.push(pointNumber);
    }
    
    // 2. 计算中位数（更稳健，不受极值影响）
    const sortedDistances = [...nearestDistances].sort((a, b) => a - b);
    const medianDistance = sortedDistances[Math.floor(sortedDistances.length / 2)];
    
    // 3. 孤立点判定：最近邻距离 > 中位数 × 倍数
    const isolationThreshold = medianDistance * config.isolatedPointRangeMultiplier;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const nearestDistance = nearestDistances[i];
      
      if (nearestDistance > isolationThreshold) {
        const ratio = (nearestDistance / medianDistance).toFixed(1);
        
        anomalies.push({
          type: 'isolated',
          pointId: point.id,
          pointNumber: point.pointNumber,
          severity: nearestDistance > isolationThreshold * 1.5 ? 'high' : 'medium',
          message: `孤立点，最近邻距离 ${nearestDistance.toFixed(1)}m（${ratio}倍中位数）`,
          details: {
            nearestDistance,
            medianDistance,
            nearestPoint: nearestPointNumbers[i],
            threshold: isolationThreshold,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * 检测重复坐标（使用空间哈希优化）
   */
  private detectDuplicateCoordinates(
    points: MeasurementPoint[],
    config: AnomalyDetectionConfig
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const tolerance = config.duplicateCoordinateTolerance;
    
    // 使用空间哈希：将坐标量化到网格
    const gridSize = tolerance * 2; // 网格大小为容差的2倍
    const spatialHash = new Map<string, MeasurementPoint[]>();
    
    // 将点分配到网格
    for (const point of points) {
      const gridX = Math.floor(point.x / gridSize);
      const gridY = Math.floor(point.y / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!spatialHash.has(key)) {
        spatialHash.set(key, []);
      }
      spatialHash.get(key)!.push(point);
    }
    
    // 只在同一网格及相邻网格内检查重复
    const checked = new Set<string>();
    
    for (const [key, gridPoints] of spatialHash) {
      const [gridX, gridY] = key.split(',').map(Number);
      
      // 收集当前网格及相邻8个网格的所有点
      const nearbyPoints: MeasurementPoint[] = [...gridPoints];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nearbyKey = `${gridX + dx},${gridY + dy}`;
          const nearby = spatialHash.get(nearbyKey);
          if (nearby) {
            nearbyPoints.push(...nearby);
          }
        }
      }
      
      for (let i = 0; i < gridPoints.length; i++) {
        const point = gridPoints[i];
        if (checked.has(point.id)) continue;
        
        const duplicates: MeasurementPoint[] = [];
        
        for (const other of nearbyPoints) {
          if (point.id === other.id || checked.has(other.id)) continue;
          
          const distance = this.calculateDistance(point, other);
          
          if (distance < tolerance) {
            duplicates.push(other);
            checked.add(other.id);
          }
        }
        
        if (duplicates.length > 0) {
          const allPoints = [point, ...duplicates];
          const pointNumbers = allPoints.map(p => p.pointNumber).join('、');
          
          for (const p of allPoints) {
            anomalies.push({
              type: 'duplicate',
              pointId: p.id,
              pointNumber: p.pointNumber,
              severity: 'medium',
              message: `坐标重复或极接近：${pointNumbers}`,
              details: {
                duplicateWith: allPoints.filter(pt => pt.id !== p.id).map(pt => pt.pointNumber),
                coordinates: { x: p.x, y: p.y, z: p.z },
              },
            });
          }
          
          checked.add(point.id);
        }
      }
    }
    
    return anomalies;
  }

  /**
   * 计算两点之间的平面距离
   */
  private calculateDistance(p1: MeasurementPoint, p2: MeasurementPoint): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 获取数值型参数值
   */
  private getNumericValue(value: string | number | undefined): number | null {
    if (value === undefined) return null;
    if (typeof value === 'number') return value;
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
