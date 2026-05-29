import { memo } from 'react';
import { Marker } from 'react-leaflet';
import { getMarkerIcon, createSelectedPointIcon } from '../../utils/mapIcons';
import { PointPopup } from './PointPopup';
import type { MeasurementPoint } from '../../types';
import type { Marker as LeafletMarker } from 'leaflet';

interface OptimizedMarkerProps {
  point: MeasurementPoint;
  isSelected: boolean;
  showPointLabels: boolean;
  measureActive: boolean;
  onMarkerRef: (id: string, ref: LeafletMarker | null) => void;
  onMeasureClick: (point: MeasurementPoint) => void;
}

/**
 * 优化的标记组件
 * 使用 React.memo 避免不必要的重新渲染
 */
export const OptimizedMarker = memo<OptimizedMarkerProps>(({
  point,
  isSelected,
  showPointLabels,
  measureActive,
  onMarkerRef,
  onMeasureClick,
}) => {
  // 根据选中状态和标签显示设置创建图标
  const icon = isSelected 
    ? createSelectedPointIcon(point.pointNumber, point.code, showPointLabels)
    : getMarkerIcon(point.type, point.pointNumber, point.code, showPointLabels);
  
  return (
    <Marker
      position={[point.lat!, point.lng!]}
      icon={icon}
      ref={(ref) => {
        onMarkerRef(point.id, ref);
      }}
      eventHandlers={{
        click: (e) => {
          // 测量模式下调用测量工具的选择函数
          if (measureActive) {
            e.originalEvent.stopPropagation();
            onMeasureClick(point);
          }
        },
      }}
    >
      {!measureActive && <PointPopup point={point} />}
    </Marker>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只有这些属性变化时才重新渲染
  return (
    prevProps.point.id === nextProps.point.id &&
    prevProps.point.lat === nextProps.point.lat &&
    prevProps.point.lng === nextProps.point.lng &&
    prevProps.point.pointNumber === nextProps.point.pointNumber &&
    prevProps.point.code === nextProps.point.code &&
    prevProps.point.type === nextProps.point.type &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showPointLabels === nextProps.showPointLabels &&
    prevProps.measureActive === nextProps.measureActive
  );
});

OptimizedMarker.displayName = 'OptimizedMarker';
