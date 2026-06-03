/**
 * 定位状态指示器组件
 * 显示当前定位方式和精度（简单文字样式）
 */

import { Capacitor } from '@capacitor/core';
import { useLocationStore, useCORSStore, useMapStore } from '../../store';
import type { FixType } from '../../types/location';

export function LocationStatusIndicator() {
  const currentPosition = useLocationStore((state) => state.currentPosition);
  const rtkStatus = useCORSStore((state) => state.rtkStatus);
  const connectionStatus = useCORSStore((state) => state.connectionStatus);
  const baseMapMode = useMapStore((state) => state.baseMapMode);
  const gridInterval = useMapStore((state) => state.gridInterval);

  /**
   * 获取定位方式文字
   */
  const getLocationModeText = () => {
    // 如果连接了 CORS 且有 RTK 状态
    if (connectionStatus === 'connected' && rtkStatus) {
      return getFixTypeText(rtkStatus.fixType);
    }
    
    // 根据精度判断定位方式
    const accuracy = currentPosition?.accuracy;
    if (!accuracy) {
      return 'GPS';
    }
    
    if (accuracy < 10) {
      return 'GPS'; // 高精度，可能是真 GPS
    } else if (accuracy < 50) {
      return 'WiFi/基站'; // 中等精度
    } else {
      return '粗略定位'; // 低精度
    }
  };

  /**
   * 获取固定解类型文字
   */
  const getFixTypeText = (fixType: FixType): string => {
    const texts: Record<FixType, string> = {
      NONE: '无定位',
      SPP: 'GPS',
      DGPS: '差分定位',
      FLOAT: 'RTK浮动解',
      FIXED: 'RTK固定解',
      SBAS: 'SBAS',
      PPP: 'PPP',
      DR: '航迹推算',
    };
    return texts[fixType] || '未知';
  };

  /**
   * 获取精度文字
   */
  const getAccuracyText = () => {
    if (connectionStatus === 'connected' && rtkStatus) {
      // RTK 模式：优先使用实际精度，否则显示理论精度
      if (currentPosition?.accuracy !== undefined && currentPosition.accuracy > 0) {
        return `±${currentPosition.accuracy.toFixed(3)}m`;
      }
      
      // 理论精度范围
      const configs: Record<FixType, string> = {
        NONE: '-',
        SPP: '±5-10m',
        DGPS: '±1-3m',
        FLOAT: '±0.2-0.5m',
        FIXED: '±0.01-0.05m',
        SBAS: '±1-3m',
        PPP: '±0.1m',
        DR: '±10m+',
      };
      return configs[rtkStatus.fixType] || '-';
    }
    
    // 普通 GPS
    return currentPosition?.accuracy ? `±${currentPosition.accuracy.toFixed(1)}m` : '-';
  };

  const modeText = getLocationModeText();
  const accuracyText = getAccuracyText();

  // 判断是否为移动端
  const isMobile = Capacitor.isNativePlatform();

  // 网格间距文字
  const intervalText = gridInterval >= 1000 
    ? `${(gridInterval / 1000).toFixed(1)}km` 
    : `${gridInterval}m`;

  return (
    <div
      style={{
        position: 'absolute',
        top: isMobile ? 5 : 10,
        right: 10,
        zIndex: 1000,
        color: '#595959',
        fontSize: 14,
        fontWeight: 500,
        pointerEvents: 'none',
        textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white',
        lineHeight: '1.2',
        textAlign: 'left', // 文字左对齐
      }}
    >
      <div>方式：{modeText}</div>
      <div>精度：{accuracyText}</div>
      {baseMapMode === 'grid' && <div>间距：{intervalText}</div>}
    </div>
  );
}
