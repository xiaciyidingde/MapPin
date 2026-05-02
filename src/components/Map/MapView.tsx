import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { Tag, Button, Modal, Input, message, Popconfirm } from 'antd';
import { SwapOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMapStore, useDataStore, useSettingsStore } from '../../store';
import { getMarkerIcon, selectedPointIcon, userLocationIcon, selectedUserLocationIcon } from '../../utils/mapIcons';
import { FitViewControl } from './FitViewControl';
import { MeasureTool, type MeasureToolRef } from './MeasureTool';
import { GridLayer } from './GridLayer';
import { getMapTileUrl, getAnnotationLayerUrl, MAP_TILE_SOURCES, switchToNextToken, hasShownTokenWarning, markWarningAsShown } from '../../config/mapTileSources';
import { coordinateConverter } from '../../services/coordinateConverter';
import type { MeasurementPoint } from '../../types';
import type { Marker as LeafletMarker } from 'leaflet';
import { appConfig } from '../../config/appConfig';

// 动态控制 Attribution 显示的组件
function AttributionController({ baseMapMode }: { baseMapMode: 'map' | 'grid' }) {
  const map = useMap();

  useEffect(() => {
    const attributionControl = map.attributionControl;
    if (attributionControl) {
      const container = attributionControl.getContainer();
      if (container) {
        if (baseMapMode === 'grid') {
          container.style.display = 'none';
        } else {
          container.style.display = 'block';
        }
      }
    }
  }, [map, baseMapMode]);

  return null;
}

// 点位信息弹窗组件
function PointPopup({ point }: { point: MeasurementPoint }) {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const updatePoint = useDataStore((state) => state.updatePoint);
  const updateFile = useDataStore((state) => state.updateFile);
  const deletePoint = useDataStore((state) => state.deletePoint);
  
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newPointNumber, setNewPointNumber] = useState('');

  const currentPoints = currentFileId ? points.get(currentFileId) || [] : [];

  // 处理过长的点号，在中间显示省略号
  const formatPointNumber = (pointNumber: string, maxLength: number = 20) => {
    if (pointNumber.length <= maxLength) {
      return pointNumber;
    }
    const frontChars = Math.ceil(maxLength / 2) - 2;
    const backChars = Math.floor(maxLength / 2) - 2;
    return `${pointNumber.substring(0, frontChars)}...${pointNumber.substring(pointNumber.length - backChars)}`;
  };

  // 切换类型
  const handleToggleType = async () => {
    if (!currentFileId) return;
    
    const newType = point.type === 'survey' ? 'control' : 'survey';
    try {
      await updatePoint(currentFileId, point.id, { type: newType });
      
      // 重新计算文件的控制点和测量点数量
      const updatedPoints = currentPoints.map(p => 
        p.id === point.id ? { ...p, type: newType } : p
      );
      const controlPointCount = updatedPoints.filter(p => p.type === 'control').length;
      const surveyPointCount = updatedPoints.filter(p => p.type === 'survey').length;
      
      // 更新文件统计信息
      const currentFile = files.find(f => f.id === currentFileId);
      if (currentFile) {
        await updateFile(currentFileId, {
          controlPointCount,
          surveyPointCount,
        });
      }
      
      message.success(`已将点 ${point.pointNumber} 标记为${newType === 'control' ? '控制点' : '碎部点'}`);
    } catch {
      message.error('修改失败');
    }
  };

  // 打开重命名对话框
  const handleOpenRename = () => {
    setNewPointNumber(point.pointNumber);
    setRenameModalOpen(true);
  };

  // 确认重命名
  const handleConfirmRename = async () => {
    if (!currentFileId) return;
    
    const trimmedName = newPointNumber.trim();
    
    if (!trimmedName) {
      message.error('点号不能为空');
      return;
    }
    
    if (trimmedName === point.pointNumber) {
      setRenameModalOpen(false);
      return;
    }
    
    // 检查点号是否已存在
    const existingPoint = currentPoints.find(
      p => p.pointNumber === trimmedName && p.id !== point.id
    );
    
    if (existingPoint) {
      message.error(`点号 ${trimmedName} 已存在`);
      return;
    }
    
    try {
      await updatePoint(currentFileId, point.id, { pointNumber: trimmedName });
      message.success(`已将点号 ${point.pointNumber} 重命名为 ${trimmedName}`);
      setRenameModalOpen(false);
      setNewPointNumber('');
    } catch {
      message.error('重命名失败');
    }
  };

  // 删除点
  const handleDeletePoint = async () => {
    if (!currentFileId) return;
    
    try {
      await deletePoint(currentFileId, point.id);
      message.success(`已删除点 ${point.pointNumber}`);
    } catch {
      message.error('删除失败');
    }
  };

  return (
    <>
      <Popup 
        minWidth={260} 
        maxWidth={260}
        closeButton={false} 
        autoClose={true} 
        closeOnEscapeKey={true}
        className="compact-popup"
      >
        <div style={{ padding: '8px 10px' }}>
          {/* 点号和类型标签 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 8,
            gap: 8
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 6,
              flex: 1,
              minWidth: 0
            }}>
              <span 
                style={{ 
                  fontSize: 20, 
                  fontWeight: 600,
                  color: '#1890ff',
                  lineHeight: 1
                }}
                title={point.pointNumber}
              >
                {formatPointNumber(point.pointNumber)}
              </span>
              {point.isManuallyAdded && (
                <span style={{ 
                  fontSize: 12, 
                  color: '#8c8c8c',
                  whiteSpace: 'nowrap',
                  lineHeight: 1
                }}>
                  手动添加
                </span>
              )}
            </div>
            <Tag color={point.type === 'control' ? 'red' : 'blue'} style={{ margin: 0, fontSize: 15, padding: '2px 8px', flexShrink: 0 }}>
              {point.type === 'control' ? '控制点' : '碎部点'}
            </Tag>
          </div>

          {/* 编码信息 */}
          {point.code && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 4, marginBottom: 4 }}>
              编码: {point.code}
            </div>
          )}

          {/* 坐标信息和操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* 左侧：坐标信息 */}
            <div style={{ 
              fontSize: 15, 
              color: '#595959',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: 1
            }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                <span style={{ color: '#8c8c8c', width: 22 }}>X:</span>
                <span style={{ fontWeight: 500 }}>{point.x.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                <span style={{ color: '#8c8c8c', width: 22 }}>Y:</span>
                <span style={{ fontWeight: 500 }}>{point.y.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                <span style={{ color: '#8c8c8c', width: 22 }}>Z:</span>
                <span style={{ fontWeight: 500 }}>{point.z.toFixed(3)}</span>
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <Popconfirm
                title="确认切换类型"
                description={`确定要将点 ${point.pointNumber} 切换为${point.type === 'survey' ? '控制点' : '碎部点'}吗？`}
                onConfirm={handleToggleType}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  size="small"
                  icon={<SwapOutlined />}
                  style={{ width: 32, height: 28, padding: 0 }}
                  title="切换类型"
                />
              </Popconfirm>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleOpenRename}
                style={{ width: 32, height: 28, padding: 0 }}
                title="重命名"
              />
              <Popconfirm
                title="确认删除"
                description={`确定要删除点 ${point.pointNumber} 吗？`}
                onConfirm={handleDeletePoint}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ width: 32, height: 28, padding: 0 }}
                  title="删除"
                />
              </Popconfirm>
            </div>
          </div>
        </div>
      </Popup>

      {/* 重命名对话框 */}
      <Modal
        title="重命名点位"
        open={renameModalOpen}
        onOk={handleConfirmRename}
        onCancel={() => {
          setRenameModalOpen(false);
          setNewPointNumber('');
        }}
        okText="确认"
        cancelText="取消"
        centered
      >
        <div style={{ marginTop: 16 }}>
          {point.originalPointNumber && point.originalPointNumber !== point.pointNumber && (
            <div style={{ marginBottom: 8, color: '#999', fontSize: 13 }}>
              原始点号: {point.originalPointNumber}
            </div>
          )}
          <div style={{ marginBottom: 8, color: '#666' }}>
            当前点号: {point.pointNumber}
          </div>
          <Input
            placeholder="请输入新点号"
            value={newPointNumber}
            onChange={(e) => setNewPointNumber(e.target.value)}
            onPressEnter={handleConfirmRename}
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}

// 自动调整视野组件
function AutoFitBounds({ points, fileId }: { points: MeasurementPoint[]; fileId: string | null }) {
  const map = useMap();
  const prevFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 只在文件切换时自动调整视野，不在点数量变化时调整
    if (fileId && fileId !== prevFileIdRef.current) {
      prevFileIdRef.current = fileId;
      
      if (points.length > 0) {
        const validPoints = points.filter((p) => p.lat && p.lng);
        if (validPoints.length > 0) {
          const bounds = validPoints.map((p) => [p.lat!, p.lng!] as [number, number]);
          // 限制最大缩放级别为 24，确保用户还可以继续放大到 25
          map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 24
          });
        }
      }
    }
  }, [fileId, points, map]); // 移除 points.length，使用 points 本身

  return null;
}

// 地图中心更新组件
function MapCenterUpdater() {
  const map = useMap();
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [center, zoom, map]);

  return null;
}

// 选中点位 Popup 打开组件
function SelectedPointPopupOpener({ markerRefs }: { markerRefs: React.MutableRefObject<Map<string, LeafletMarker>> }) {
  const selectedPointId = useMapStore((state) => state.selectedPointId);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);

  useEffect(() => {
    if (selectedPointId) {
      setTimeout(() => {
        const marker = markerRefs.current.get(selectedPointId);
        if (marker) {
          marker.openPopup();
        }
        setSelectedPointId(null);
      }, 300);
    }
  }, [selectedPointId, markerRefs, setSelectedPointId]);

  return null;
}

// 测量模式样式更新组件
function MeasureModeStyle({ active }: { active: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (active) {
      container.classList.add('measure-active');
    } else {
      container.classList.remove('measure-active');
    }
    
    return () => {
      container.classList.remove('measure-active');
    };
  }, [active, map]);

  return null;
}

export function MapView({ measureActive = false }: { measureActive?: boolean }) {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const userLocation = useMapStore((state) => state.userLocation);
  const userLocationAccuracy = useMapStore((state) => state.userLocationAccuracy);
  const baseMapMode = useMapStore((state) => state.baseMapMode);
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const locationPermissionDenied = useMapStore((state) => state.locationPermissionDenied);
  
  // 地图设置
  const showUserLocation = useSettingsStore((state) => state.showUserLocation);
  const showPointLabelsConfig = useSettingsStore((state) => state.showPointLabels);
  const mapTileSource = useSettingsStore((state) => state.mapTileSource);
  const apiKeys = useSettingsStore((state) => state.apiKeys);

  // Token 切换计数器，用于强制刷新 TileLayer
  const [tokenSwitchCount, setTokenSwitchCount] = useState(0);

  // 获取当前地图源配置
  const tileSourceConfig = useMemo(() => {
    const source = MAP_TILE_SOURCES[mapTileSource];
    
    const url = getMapTileUrl(mapTileSource, apiKeys.tianditu);
    const annotationLayerUrl = getAnnotationLayerUrl(mapTileSource, apiKeys.tianditu);
    return {
      url,
      attribution: source?.attribution || '',
      maxZoom: source?.maxZoom || 25,
      maxNativeZoom: source?.maxNativeZoom || 19,
      subdomains: source?.subdomains || undefined,
      annotationLayerUrl,
    };
  }, [mapTileSource, apiKeys.tianditu]);

  // 存储所有 Marker 的 ref
  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map());
  
  // 测量工具的 ref
  const measureToolRef = useRef<MeasureToolRef>(null);
  
  // 选中的点 ID 列表
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  
  // 底图切换动画状态
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousMode, setPreviousMode] = useState<'map' | 'grid'>(baseMapMode);
  
  // 监听底图模式变化，触发过渡动画
  useEffect(() => {
    if (baseMapMode !== previousMode) {
      // 使用 requestAnimationFrame 来避免在 effect 中直接调用 setState
      const rafId = requestAnimationFrame(() => {
        setIsTransitioning(true);
        // 300ms 后结束过渡
        const timer = setTimeout(() => {
          setIsTransitioning(false);
          setPreviousMode(baseMapMode);
        }, 300);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [baseMapMode, previousMode]);
  
  // 当测量模式关闭时清空选中的点
  useEffect(() => {
    if (!measureActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPointIds([]);
    }
  }, [measureActive]);

  const currentPoints = currentFileId ? points.get(currentFileId) || [] : [];
  const validPoints = currentPoints.filter((p) => p.lat && p.lng);
  
  // 当点位数量大于 500 时，自动禁用点位号悬浮窗以提升性能
  const TOOLTIP_THRESHOLD = 500;
  const showPointLabels = showPointLabelsConfig && currentPoints.length <= TOOLTIP_THRESHOLD;
  
  // 智能聚合逻辑：根据点数量动态调整
  // 点数量 >= 500 时启用聚合，但在高缩放级别（>= 16）时停止聚合
  const CLUSTER_THRESHOLD = 500;
  const shouldCluster = validPoints.length >= CLUSTER_THRESHOLD;
  
  // 动态计算聚合半径：点越多，聚合半径越大
  const calculateClusterRadius = () => {
    if (validPoints.length < 1000) return 50;
    if (validPoints.length < 2000) return 60;
    if (validPoints.length < 5000) return 70;
    return 80;
  };
  
  // 动态计算停止聚合的缩放级别：点越多，越晚停止聚合
  const calculateDisableClusteringZoom = () => {
    if (validPoints.length < 1000) return 16;
    if (validPoints.length < 2000) return 17;
    if (validPoints.length < 5000) return 18;
    return 19;
  };

  // 渲染单个标记点
  const renderMarker = (point: MeasurementPoint) => {
    // 判断点是否被选中
    const isSelected = selectedPointIds.includes(point.id);
    // 如果被选中，使用红色图标；否则使用原来的图标
    const icon = isSelected ? selectedPointIcon : getMarkerIcon(point.type);
    
    return (
      <Marker
        key={point.id}
        position={[point.lat!, point.lng!]}
        icon={icon}
        ref={(ref) => {
          if (ref) {
            markerRefs.current.set(point.id, ref);
          }
        }}
        eventHandlers={{
          click: (e) => {
            // 测量模式下调用测量工具的选择函数
            if (measureActive) {
              e.originalEvent.stopPropagation();
              measureToolRef.current?.selectPoint(point);
            }
          },
        }}
      >
        {!measureActive && <PointPopup point={point} />}
        {showPointLabels && (
          <Tooltip direction="top" offset={[0, -20]} opacity={0.9} permanent>
            {point.pointNumber}
          </Tooltip>
        )}
      </Marker>
    );
  };

  // 始终显示地图，即使没有选择文件
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={3}
        maxZoom={25}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        style={{ 
          height: '100%', 
          width: '100%',
          cursor: measureActive ? 'crosshair' : 'grab'
        }}
      >
      {/* 根据模式显示不同的底图，使用交叉淡化动画 */}
      {/* 过渡期间同时渲染两个图层 */}
      {(baseMapMode === 'map' || (isTransitioning && previousMode === 'map')) && (
        <>
          {/* 主地图图层 */}
          <TileLayer
            key={`${mapTileSource}-${apiKeys.tianditu || 'no-token'}-${tokenSwitchCount}`}
            attribution={tileSourceConfig.attribution}
            url={tileSourceConfig.url}
            minZoom={3}
            maxNativeZoom={tileSourceConfig.maxNativeZoom}
            maxZoom={tileSourceConfig.maxZoom}
            {...(tileSourceConfig.subdomains && { subdomains: tileSourceConfig.subdomains })}
            opacity={baseMapMode === 'map' ? 1 : 0}
            // 瓦片预加载优化 - 提升平移体验
            keepBuffer={6}           // 视口外保留6行/列瓦片（默认2）
            updateWhenIdle={false}   // 平移时持续加载瓦片
            updateWhenZooming={true} // 缩放时更新瓦片
            updateInterval={150}     // 瓦片更新间隔150ms
            eventHandlers={{
              tileerror: (error) => {
                // 检测是否是天地图瓦片加载失败（且用户未配置个人 Token）
                const errorTile = error.tile as HTMLImageElement;
                const errorUrl = errorTile?.src || '';
                if (errorUrl.includes('tianditu.gov.cn') && !apiKeys.tianditu) {
                  console.error('天地图瓦片加载失败，可能是 Token 超限');
                  
                  // 检查是否有公共 Token 配置
                  const hasPublicTokens = appConfig.map.tianDiTuTokens && appConfig.map.tianDiTuTokens.length > 0;
                  
                  // 如果没有公共 Token，不显示任何用户提示
                  if (!hasPublicTokens) {
                    return;
                  }
                  
                  // 如果已经显示过警告，不再处理（避免重复提示）
                  if (hasShownTokenWarning()) {
                    return;
                  }
                  
                  // 尝试切换到下一个可用的 Token
                  const switched = switchToNextToken();
                  
                  if (switched) {
                    // 成功切换，更新计数器强制刷新 TileLayer
                    setTokenSwitchCount(prev => prev + 1);
                  } else {
                    // 所有 Token 都已失败，显示错误提示
                    markWarningAsShown();
                    
                    message.error({
                      content: '所有默认 Token 都已失败，请申请个人 Token 以获得稳定服务',
                      duration: 5,
                    });
                  }
                }
              }
            }}
          />
          
          {/* 标注图层（如果存在） */}
          {tileSourceConfig.annotationLayerUrl && (
            <TileLayer
              key={`${mapTileSource}-annotation-${apiKeys.tianditu || 'no-token'}-${tokenSwitchCount}`}
              url={tileSourceConfig.annotationLayerUrl}
              minZoom={3}
              maxNativeZoom={tileSourceConfig.maxNativeZoom}
              maxZoom={tileSourceConfig.maxZoom}
              {...(tileSourceConfig.subdomains && { subdomains: tileSourceConfig.subdomains })}
              opacity={baseMapMode === 'map' ? 1 : 0}
              // 瓦片预加载优化
              keepBuffer={6}
              updateWhenIdle={false}
              updateWhenZooming={true}
              updateInterval={150}
              eventHandlers={{
                tileerror: (error) => {
                  // 标注图层失败时也检测（避免重复处理，只记录日志）
                  const errorTile = error.tile as HTMLImageElement;
                  const errorUrl = errorTile?.src || '';
                  if (errorUrl.includes('tianditu.gov.cn') && !apiKeys.tianditu) {
                    console.error('天地图标注图层加载失败');
                  }
                }
              }}
            />
          )}
        </>
      )}
      
      {(baseMapMode === 'grid' || (isTransitioning && previousMode === 'grid')) && (
        <div 
          style={{ 
            opacity: baseMapMode === 'grid' ? 1 : 0,
            transition: 'opacity 300ms ease-in-out',
            pointerEvents: baseMapMode === 'grid' ? 'auto' : 'none'
          }}
        >
          <GridLayer />
        </div>
      )}

      {shouldCluster ? (
        // 点数量 >= 500：使用智能聚合
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={calculateClusterRadius()}
          disableClusteringAtZoom={calculateDisableClusteringZoom()}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          animate={true}
          animateAddingMarkers={false}
        >
          {/* 先渲染测量点 */}
          {validPoints
            .filter((point) => point.type === 'survey')
            .map(renderMarker)}

          {/* 再渲染控制点，确保显示在测量点上层 */}
          {validPoints
            .filter((point) => point.type === 'control')
            .map(renderMarker)}
        </MarkerClusterGroup>
      ) : (
        // 点数量 < 500：直接渲染，不使用聚合
        <>
          {/* 先渲染测量点 */}
          {validPoints
            .filter((point) => point.type === 'survey')
            .map(renderMarker)}

          {/* 再渲染控制点，确保显示在测量点上层 */}
          {validPoints
            .filter((point) => point.type === 'control')
            .map(renderMarker)}
        </>
      )}

      {/* 用户当前位置标记 */}
      {showUserLocation && userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={selectedPointIds.includes('user-location') ? selectedUserLocationIcon : userLocationIcon}
          zIndexOffset={1000}
          eventHandlers={{
            click: (e) => {
              // 测量模式下允许选择当前位置
              if (measureActive) {
                e.originalEvent.stopPropagation();
                
                // 获取当前文件的投影配置
                const currentFile = currentFileId ? files.find(f => f.id === currentFileId) : null;
                
                // 将经纬度转换为投影坐标
                let projectedX = userLocation.lng;
                let projectedY = userLocation.lat;
                
                if (currentFile) {
                  const projected = coordinateConverter.projectFromWGS84(
                    userLocation.lat,
                    userLocation.lng,
                    currentFile.projectionConfig.coordinateSystem,
                    currentFile.projectionConfig.projectionType,
                    currentFile.projectionConfig.centralMeridian
                  );
                  projectedX = projected.x;
                  projectedY = projected.y;
                }
                
                // 创建虚拟的 MeasurementPoint 对象
                const userLocationPoint: MeasurementPoint = {
                  id: 'user-location',
                  fileId: 'virtual', // 虚拟文件ID
                  pointNumber: '当前位置',
                  originalPointNumber: '当前位置',
                  x: projectedX, // 使用投影坐标
                  y: projectedY, // 使用投影坐标
                  z: 0, // 高程未知，设为 0
                  lat: userLocation.lat,
                  lng: userLocation.lng,
                  type: 'survey',
                  order: -1, // 虚拟顺序
                };
                
                measureToolRef.current?.selectPoint(userLocationPoint);
              }
            },
          }}
        >
          {!measureActive && (
            <Popup
              closeButton={false}
              autoClose={true}
              closeOnEscapeKey={true}
              className="compact-popup"
            >
              <div style={{ padding: '8px 10px' }}>
                {/* 标题 */}
                <div style={{ 
                  fontSize: 20, 
                  fontWeight: 600,
                  color: '#1890ff',
                  marginBottom: 8
                }}>
                  当前位置
                </div>

                {/* 坐标和精度信息 */}
                <div style={{ 
                  fontSize: 15, 
                  color: '#595959',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                    <span style={{ color: '#8c8c8c', width: 44 }}>纬度:</span>
                    <span style={{ fontWeight: 500 }}>{userLocation.lat.toFixed(6)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                    <span style={{ color: '#8c8c8c', width: 44 }}>经度:</span>
                    <span style={{ fontWeight: 500 }}>{userLocation.lng.toFixed(6)}</span>
                  </div>
                  {userLocationAccuracy !== null && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 28 }}>
                      <span style={{ color: '#8c8c8c', width: 44 }}>精度:</span>
                      <span style={{ fontWeight: 500 }}>±{userLocationAccuracy.toFixed(1)} 米</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      )}

      <MapCenterUpdater />
      <AttributionController baseMapMode={baseMapMode} />
      <MeasureModeStyle active={measureActive} />
      <SelectedPointPopupOpener markerRefs={markerRefs} />
      <FitViewControl />
      {currentFileId && <AutoFitBounds points={validPoints} fileId={currentFileId} />}
      
      {/* 测量工具 */}
      <MeasureTool 
        ref={measureToolRef}
        points={validPoints} 
        active={measureActive}
        onClose={() => {}}
        onSelectedPointsChange={setSelectedPointIds}
      />
    </MapContainer>

      {/* 右上角定位精度指示器 */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          color: '#595959',
          fontSize: 14,
          fontWeight: 500,
          pointerEvents: 'none',
          textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white',
        }}
      >
        {locationPermissionDenied ? (
          <span>定位精度：无权限</span>
        ) : userLocationAccuracy !== null ? (
          <span>定位精度：±{userLocationAccuracy.toFixed(1)} 米</span>
        ) : null}
      </div>
    </div>
  );
}
