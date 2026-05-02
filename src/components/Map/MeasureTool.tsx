import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import { message } from 'antd';
import type { MeasurementPoint } from '../../types';
import {
  calculateSpatialDistance,
  calculatePlanarDistance,
  calculateElevationDifference,
  formatDistance,
  formatElevation,
} from '../../services/measurementService';

interface MeasureToolProps {
  points: MeasurementPoint[];
  active: boolean;
  onClose: () => void;
  onSelectedPointsChange?: (pointIds: string[]) => void;
}

export interface MeasureToolRef {
  selectPoint: (point: MeasurementPoint) => void;
  getSelectedPointIds: () => string[];
}

export const MeasureTool = forwardRef<MeasureToolRef, MeasureToolProps>(
  ({ active, onSelectedPointsChange }, ref) => {
    const [selectedPoints, setSelectedPoints] = useState<MeasurementPoint[]>([]);

    // 处理点击选择
    const handlePointSelect = useCallback((point: MeasurementPoint) => {
      if (!active) return;
      
      setSelectedPoints(prev => {
        if (prev.length === 0) {
          message.info('已选择起点，请选择终点');
          return [point];
        } else if (prev.length === 1) {
          const isClickingSamePoint = prev[0].id === point.id;
          if (!isClickingSamePoint) {
            message.success('测量完成');
            return [prev[0], point];
          } else {
            message.warning('请选择不同的点');
            return prev;
          }
        } else {
          // 已有两个点，重新开始
          message.info('已选择起点，请选择终点');
          return [point];
        }
      });
    }, [active]);

    // 暴露选择函数给父组件
    useImperativeHandle(ref, () => ({
      selectPoint: handlePointSelect,
      getSelectedPointIds: () => selectedPoints.map(p => p.id),
    }), [handlePointSelect, selectedPoints]);

  // 当测量工具关闭时清除选择
  useEffect(() => {
    if (!active) {
      setSelectedPoints([]);
    }
  }, [active]);
  
  // 当选中的点变化时通知父组件
  useEffect(() => {
    if (onSelectedPointsChange) {
      onSelectedPointsChange(selectedPoints.map(p => p.id));
    }
  }, [selectedPoints, onSelectedPointsChange]);

  if (!active || selectedPoints.length === 0) {
    return null;
  }

  // 检查是否包含当前位置点（id 为 'user-location'）
  const hasUserLocation = selectedPoints.some(p => p.id === 'user-location');

  // 计算测量结果
  let spatialDistance = 0;
  let planarDistance = 0;
  let elevationDiff = 0;
  
  if (selectedPoints.length === 2) {
    spatialDistance = calculateSpatialDistance(selectedPoints[0], selectedPoints[1]);
    planarDistance = calculatePlanarDistance(selectedPoints[0], selectedPoints[1]);
    // 只有当两个点都不是当前位置时才计算高差
    if (!hasUserLocation) {
      elevationDiff = calculateElevationDifference(selectedPoints[0], selectedPoints[1]);
    }
  }

  // 绘制连线的坐标
  const linePositions = selectedPoints
    .filter((p) => p.lat && p.lng)
    .map((p) => [p.lat!, p.lng!] as [number, number]);

  return (
    <>
      {/* 绘制连线 */}
      {linePositions.length === 2 && (
        <Polyline
          positions={linePositions}
          pathOptions={{
            color: '#1890ff',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
          }}
        >
          {/* 测量结果提示，提高层级 */}
          <Tooltip 
            direction="top" 
            offset={[0, -10]}
            permanent 
            opacity={0.95}
            className="measurement-tooltip"
            pane="tooltipPane"
          >
            <div style={{ 
              padding: '8px 12px',
              fontSize: '14px',
              lineHeight: '1.6',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '2px solid #1890ff',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1890ff' }}>
                {formatDistance(spatialDistance)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                平面: {formatDistance(planarDistance)}
              </div>
              {/* 只有当不包含当前位置时才显示高差 */}
              {!hasUserLocation && (
                <div style={{ fontSize: '12px', color: elevationDiff >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  高差: {formatElevation(elevationDiff)}
                </div>
              )}
            </div>
          </Tooltip>
        </Polyline>
      )}
    </>
  );
});
