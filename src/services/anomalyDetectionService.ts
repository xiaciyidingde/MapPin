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
   * 检测孤立点（远离测绘范围的点，使用空间网格优化）
   */
  private detectIsolatedPoints(points: MeasurementPoint[], config: AnomalyDetectionConfig): Anomaly[] {
    if (points.length < 3) return []; // 点数太少无法判定

    const anomalies: Anomaly[] = [];

    // 计算测绘范围的边界框
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    // 计算边界框的中心点
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // 计算边界框的"半径"（从中心到角的距离）
    const rangeRadius = Math.sqrt(
      Math.pow((maxX - minX) / 2, 2) + Math.pow((maxY - minY) / 2, 2)
    );
    
    // 使用空间网格加速最近点查找
    const gridSize = Math.max(rangeRadius / 10, 1); // 将范围分成10x10网格，最小1米
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
      
      // 只检查当前网格及相邻网格
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
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
    
    // 孤立点判定：距离中心超过配置倍数的范围半径
    const isolationThreshold = rangeRadius * config.isolatedPointRangeMultiplier;
    
    for (const point of points) {
      const distanceFromCenter = Math.sqrt(
        Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
      );
      
      if (distanceFromCenter > isolationThreshold) {
        const { distance: nearestDistance, pointNumber: nearestPoint } = findNearestPoint(point);
        const ratio = (distanceFromCenter / rangeRadius).toFixed(1);
        
        anomalies.push({
          type: 'isolated',
          pointId: point.id,
          pointNumber: point.pointNumber,
          severity: distanceFromCenter > isolationThreshold * 1.5 ? 'high' : 'medium',
          message: `远离测绘范围，距离中心 ${distanceFromCenter.toFixed(1)}m（${ratio}倍范围半径）`,
          details: {
            distanceFromCenter,
            rangeRadius,
            nearestDistance,
            nearestPoint,
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
