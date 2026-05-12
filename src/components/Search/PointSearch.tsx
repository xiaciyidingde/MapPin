import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input, Tag, Empty, Dropdown, Button, Spin, message, theme } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, CloseCircleFilled, EnvironmentOutlined, GlobalOutlined, DownOutlined } from '@ant-design/icons';
import { useDataStore, useMapStore, useSettingsStore } from '../../store';
import { tiandituSearchService, type TiandituPOI, type TiandituArea, type TiandituSearchResponse } from '../../services/tiandituSearchService';
import { formatDistance } from '../../services/measurementService';
import type { MeasurementPoint } from '../../types';

type SearchMode = 'point' | 'place';

// 周边搜索类别词（使用 Set 实现 O(1) 查找）
const NEARBY_CATEGORIES = new Set([
  // 餐饮
  '餐厅', '饭店', '餐馆', '美食', '小吃', '快餐', '火锅', '烧烤', '咖啡', '奶茶', '甜品',
  // 购物
  '超市', '商场', '便利店', '商店', '市场', '药店',
  // 服务
  '银行', 'ATM', '医院', '诊所', '酒店', '宾馆', '加油站', '停车场',
  // 交通
  '地铁', '公交', '车站', '机场',
  // 娱乐
  '电影院', '影院', 'KTV', '健身房', '公园',
  // 生活服务
  '厕所', '卫生间', '快递',
  // 教育
  '学校', '幼儿园', '培训',
]);

// 周边搜索意图词（预编译正则）
const NEARBY_INTENT_REGEX = /附近|周边|周围|附近的|周边的|周围的|附近有|周边有|周围有|离我最近的|方圆/;

// 搜索结果缓存
interface SearchCache {
  key: string;
  results: (TiandituPOI | TiandituArea)[];
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
let searchCache: SearchCache | null = null;

/**
 * 判断是否为周边搜索（优化版本，< 1ms）
 */
function isNearbySearch(query: string): boolean {
  // 1. 检查意图词（最快）
  if (NEARBY_INTENT_REGEX.test(query)) {
    return true;
  }
  
  // 2. 检查类别词（O(1) 查找）
  for (const category of NEARBY_CATEGORIES) {
    if (query.includes(category)) {
      return true;
    }
  }
  
  return false;
}

export function PointSearch({ disabled = false }: { disabled?: boolean }) {
  const [searchText, setSearchText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [matchedPoints, setMatchedPoints] = useState<MeasurementPoint[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>('point');
  const [placeResults, setPlaceResults] = useState<(TiandituPOI | TiandituArea)[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const { token } = theme.useToken();
  
  const currentFileId = useMapStore((state) => state.currentFileId);
  const setView = useMapStore((state) => state.setView);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);
  const setSearchMarker = useMapStore((state) => state.setSearchMarker);
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const mapBounds = useMapStore((state) => state.mapBounds);
  const userLocation = useMapStore((state) => state.userLocation);
  const mapTileSource = useSettingsStore((state) => state.mapTileSource);
  const tianDiTuToken = useSettingsStore((state) => state.apiKeys.tianditu);

  // 检查是否使用天地图
  const isTianditu = mapTileSource?.startsWith('tianditu-') || false;

  // 非天地图时自动切换回点位模式
  useEffect(() => {
    if (!isTianditu && searchMode === 'place') {
      // 使用 queueMicrotask 避免同步 setState
      queueMicrotask(() => setSearchMode('point'));
    }
  }, [isTianditu, searchMode]);

  // 搜索匹配 - 点位搜索
  useEffect(() => {
    if (searchMode !== 'point' || !currentFileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatchedPoints([]);
      return;
    }

    // 在 effect 内部获取当前文件的点位
    const currentPoints = useDataStore.getState().points.get(currentFileId) || [];
    
    if (!searchText.trim()) {
      // 没有搜索词时，显示前500个点
      setMatchedPoints(currentPoints.slice(0, 500));
      return;
    }

    const query = searchText.toLowerCase();
    const matches = currentPoints
      .filter(point => point.pointNumber.toLowerCase().includes(query))
      .sort((a, b) => {
        // 按匹配位置排序：匹配位置越靠前，排序越靠前
        const indexA = a.pointNumber.toLowerCase().indexOf(query);
        const indexB = b.pointNumber.toLowerCase().indexOf(query);
        return indexA - indexB;
      });
    
    setMatchedPoints(matches);
  }, [searchText, currentFileId, searchMode]);

  // 地名搜索 - 防抖
  useEffect(() => {
    if (searchMode !== 'place') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaceResults([]);
      return;
    }

    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchText.trim()) {
      setPlaceResults([]);
      return;
    }

    // 检查Token
    if (!tianDiTuToken) {
      message.warning('请先在设置中配置天地图Token');
      return;
    }

    // 检查缓存（包含 mapBounds 以确保视图变化时重新搜索）
    const cacheKey = `${searchText}-${center.lng}-${center.lat}-${zoom}-${mapBounds?.minX}-${mapBounds?.minY}-${mapBounds?.maxX}-${mapBounds?.maxY}`;
    if (searchCache && searchCache.key === cacheKey && Date.now() - searchCache.timestamp < CACHE_DURATION) {
      setPlaceResults(searchCache.results);
      return;
    }

    // 防抖：500ms后执行搜索
    let cancelled = false;
    searchTimerRef.current = setTimeout(async () => {
      if (cancelled) return;
      
      setSearching(true);
      try {
        // 智能判断搜索类型
        const useNearbySearch = isNearbySearch(searchText);
        
        let result: TiandituSearchResponse;
        
        if (useNearbySearch) {
          // 周边搜索
          // 确定搜索中心：当前位置 > 搜索标记 > 地图中心
          const searchCenter = userLocation || 
            (useMapStore.getState().searchMarker ? {
              lng: useMapStore.getState().searchMarker!.lng,
              lat: useMapStore.getState().searchMarker!.lat,
            } : center);
          
          // 如果没有当前位置且没有搜索标记，提示用户
          if (!userLocation && !useMapStore.getState().searchMarker) {
            message.info('周边搜索将以地图中心为基准');
          }
          
          // 先搜索 3km 范围
          result = await tiandituSearchService.searchNearby(
            searchText,
            tianDiTuToken,
            searchCenter,
            3000,
            { count: 20 }
          );
          
          // 如果无结果，扩大到 10km
          if (!result.pois || result.pois.length === 0) {
            result = await tiandituSearchService.searchNearby(
              searchText,
              tianDiTuToken,
              searchCenter,
              10000,
              { count: 20 }
            );
          }
        } else {
          // 地名搜索
          // 使用真实的地图边界（如果可用），否则使用估算值
          let bounds;
          if (mapBounds) {
            bounds = mapBounds;
          } else {
            // 降级方案：使用估算值
            const latOffset = 0.1 / Math.pow(2, zoom - 10);
            const lngOffset = 0.1 / Math.pow(2, zoom - 10);
            bounds = {
              minX: center.lng - lngOffset,
              minY: center.lat - latOffset,
              maxX: center.lng + lngOffset,
              maxY: center.lat + latOffset,
            };
          }
          
          result = await tiandituSearchService.searchPlace(
            searchText,
            tianDiTuToken,
            bounds,
            zoom
          );
        }

        // 合并POI和行政区结果
        const results: (TiandituPOI | TiandituArea)[] = [];
        if (result.pois) {
          results.push(...result.pois);
        }
        if (result.area) {
          results.push(...result.area);
        }

        // 更新缓存
        searchCache = {
          key: cacheKey,
          results,
          timestamp: Date.now(),
        };

        if (cancelled) return;
        setPlaceResults(results);
      } catch (error) {
        console.error('地名搜索失败:', error);
        if (cancelled) return;
        
        // 根据错误类型给出差异化提示
        if (error instanceof TypeError) {
          message.error('网络异常，请检查网络连接');
        } else if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes('token') || errorMsg.includes('tk') || errorMsg.includes('密钥')) {
            message.error('Token 无效，请检查配置');
          } else if (errorMsg.includes('权限') || errorMsg.includes('permission')) {
            message.error('权限不足，请检查 Token 权限');
          } else {
            message.error(error.message || '搜索失败，请稍后重试');
          }
        } else {
          message.error('搜索失败，请稍后重试');
        }
        setPlaceResults([]);
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchText, searchMode, tianDiTuToken, center, zoom, mapBounds, userLocation]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 选择点位
  const handleSelectPoint = (point: MeasurementPoint) => {
    if (point.lat && point.lng) {
      setView({ lat: point.lat, lng: point.lng }, 19);
      setSelectedPointId(point.id);
      setShowResults(false);
      setSearchText('');
    }
  };

  // 选择地名
  const handleSelectPlace = (place: TiandituPOI | TiandituArea) => {
    const coord = tiandituSearchService.parseCoordinate(place.lonlat);
    if (coord) {
      // 根据结果类型决定缩放级别
      const zoom = 'bound' in place ? 12 : 16; // 行政区用12级，POI用16级
      
      // 设置搜索标记
      const isPOI = 'address' in place;
      setSearchMarker({
        lat: coord.lat,
        lng: coord.lng,
        name: place.name,
        address: isPOI ? (place as TiandituPOI).address : undefined,
      });
      
      setView({ lat: coord.lat, lng: coord.lng }, zoom);
      setShowResults(false);
      setSearchText('');
    }
  };

  // 高亮匹配文本
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    // 转义正则特殊字符
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escaped = escapeRegExp(query);
    
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} style={{ backgroundColor: '#fff566', fontWeight: 600 }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // 计算地点到当前位置的距离
  const calculateDistanceToUser = (place: TiandituPOI | TiandituArea): number | null => {
    if (!userLocation) return null;
    
    const coord = tiandituSearchService.parseCoordinate(place.lonlat);
    if (!coord) return null;
    
    // 使用 Haversine 公式计算距离
    const R = 6371000; // 地球半径（米）
    const dLat = (coord.lat - userLocation.lat) * Math.PI / 180;
    const dLng = (coord.lng - userLocation.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(coord.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 获取距离显示文本（只有获取到当前位置时才显示）
  const getDistanceText = (place: TiandituPOI | TiandituArea): string | null => {
    // 没有当前位置，不显示距离
    if (!userLocation) return null;
    
    // 如果是 POI 且有 distance 字段（周边搜索返回），直接使用
    if ('distance' in place && place.distance) {
      return place.distance;
    }
    
    // 否则计算到当前位置的距离
    const distance = calculateDistanceToUser(place);
    return distance !== null ? formatDistance(distance) : null;
  };

  // 搜索模式切换菜单
  const modeMenuItems: MenuProps['items'] = [
    {
      key: 'point',
      icon: <EnvironmentOutlined style={{ color: '#1890ff' }} />,
      label: '点位',
    },
    {
      key: 'place',
      icon: <GlobalOutlined style={{ color: '#52c41a' }} />,
      label: '地名',
    },
  ];

  const handleModeChange: MenuProps['onClick'] = ({ key }) => {
    setSearchMode(key as SearchMode);
    setSearchText(''); // 切换模式时清空搜索
  };

  // 获取当前模式的占位符
  const getPlaceholder = () => {
    if (searchMode === 'point' && !currentFileId) return '请先选择文件';
    return searchMode === 'point' ? '搜索点号...' : '搜索地名...';
  };

  return (
    <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 400, margin: '0 20px', zIndex: 11 }}>
      <Input
        placeholder={getPlaceholder()}
        prefix={
          isTianditu ? (
            // 天地图：显示切换按钮
            <Dropdown 
              menu={{ items: modeMenuItems, onClick: handleModeChange, selectedKeys: [searchMode] }}
              trigger={['click']}
              disabled={disabled}
            >
              <Button 
                type="text" 
                size="small" 
                style={{ 
                  padding: '0 4px',
                  height: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
                disabled={disabled}
              >
                {searchMode === 'point' ? (
                  <EnvironmentOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                ) : (
                  <GlobalOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                )}
                <DownOutlined style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)' }} />
              </Button>
            </Dropdown>
          ) : (
            // 非天地图：只显示搜索图标
            <SearchOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
          )
        }
        suffix={
          searchText && (
            <CloseCircleFilled
              style={{ color: 'rgba(0,0,0,0.25)', cursor: 'pointer' }}
              onClick={() => {
                setSearchText('');
              }}
            />
          )
        }
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onFocus={() => {
          if (!disabled) {
            setShowResults(true);
            // 如果还没有加载数据，立即加载
            if (matchedPoints.length === 0 && currentFileId) {
              const currentPoints = useDataStore.getState().points.get(currentFileId) || [];
              setMatchedPoints(currentPoints.slice(0, 500));
            }
          }
        }}
        onBlur={() => {
          // 延迟关闭，以便点击结果项时能触发
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              !searchRef.current?.contains(activeElement) &&
              !resultsRef.current?.contains(activeElement)
            ) {
              setShowResults(false);
            }
          }, 200);
        }}
        disabled={(searchMode === 'point' && !currentFileId) || disabled}
        size="large"
        style={{
          borderRadius: 24,
          backgroundColor: token.colorBgContainer,
          border: `2px solid ${token.colorBorder}`,
          height: 44,
          position: 'relative',
          zIndex: 11
        }}
      />

      {/* 匹配结果列表 - 使用 Portal 渲染到 body */}
      {showResults && !disabled && (searchMode === 'point' ? currentFileId : true) && createPortal(
        <>
          {/* 半透明遮罩层 */}
          <div style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            zIndex: 999
          }} onClick={() => setShowResults(false)} />
          
          {/* 匹配框 */}
          <div
            ref={resultsRef}
            className="search-results-popup"
            style={{
              position: 'fixed',
              top: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)',
              maxWidth: 400,
              backgroundColor: token.colorBgElevated,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: 320,
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {/* 点位搜索结果 */}
            {searchMode === 'point' && (
              matchedPoints.length === 0 ? (
                <div style={{ padding: 24 }}>
                  <Empty description="未找到匹配的点位" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : (
                <>
                  {/* 结果数量提示 */}
                  {searchText && (
                    <div style={{ 
                      padding: '8px 16px', 
                      fontSize: 12, 
                      color: token.colorTextSecondary,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      backgroundColor: token.colorBgContainer
                    }}>
                      找到 {matchedPoints.length} 个匹配点位
                    </div>
                  )}
                
                {matchedPoints.slice(0, 500).map((point, index) => (
                  <div
                    key={point.id}
                    onMouseDown={(e) => {
                      // 使用 onMouseDown 而不是 onClick，防止被 onBlur 拦截
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectPoint(point);
                    }}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: index < Math.min(matchedPoints.length, 500) - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                      transition: 'all 0.2s',
                      backgroundColor: token.colorBgElevated
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = token.colorBgContainer;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = token.colorBgElevated;
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 500, color: token.colorText }}>
                        {highlightText(point.pointNumber, searchText)}
                      </span>
                      <Tag 
                        color={point.type === 'control' ? 'red' : 'blue'} 
                        style={{ margin: 0, borderRadius: 4, fontSize: 12 }}
                      >
                        {point.type === 'control' ? '控制点' : '碎部点'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 13, color: token.colorTextSecondary, fontFamily: 'monospace' }}>
                      X: {point.x.toFixed(3)} Y: {point.y.toFixed(3)} Z: {point.z.toFixed(3)}
                    </div>
                  </div>
                ))}
                
                {/* 显示更多提示 */}
                {matchedPoints.length > 500 && (
                  <div style={{ 
                    padding: '12px 16px', 
                    fontSize: 12, 
                    color: token.colorTextSecondary,
                    textAlign: 'center',
                    backgroundColor: token.colorBgContainer,
                    borderTop: `1px solid ${token.colorBorderSecondary}`
                  }}>
                    还有 {matchedPoints.length - 500} 个结果未显示，请输入更多关键词缩小范围
                  </div>
                )}
              </>
              )
            )}

            {/* 地名搜索结果 */}
            {searchMode === 'place' && (
              searching ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Spin size="large">
                    <div style={{ marginTop: 16 }}>搜索中...</div>
                  </Spin>
                </div>
              ) : placeResults.length === 0 ? (
                <div style={{ padding: 24 }}>
                  <Empty 
                    description={searchText ? "未找到相关地点" : "请输入地名进行搜索"} 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                  />
                </div>
              ) : (
                <>
                  {/* 结果数量提示 */}
                  <div style={{ 
                    padding: '8px 16px', 
                    fontSize: 12, 
                    color: token.colorTextSecondary,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    backgroundColor: token.colorBgContainer
                  }}>
                    找到 {placeResults.length} 个地点
                  </div>
                  
                  {placeResults.map((place, index) => {
                    const isPOI = 'address' in place;
                    const isArea = 'bound' in place;
                    const distanceText = getDistanceText(place);
                    
                    return (
                      <div
                        key={isPOI ? (place as TiandituPOI).hotPointID : `area-${index}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectPlace(place);
                        }}
                        style={{
                          padding: '14px 16px',
                          cursor: 'pointer',
                          borderBottom: index < placeResults.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                          transition: 'all 0.2s',
                          backgroundColor: token.colorBgElevated
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = token.colorBgContainer;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = token.colorBgElevated;
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <GlobalOutlined style={{ color: '#52c41a', fontSize: 18, marginTop: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 16, fontWeight: 500, color: token.colorText }}>
                                {place.name}
                              </span>
                              {isArea && (
                                <Tag color="purple" style={{ margin: 0, borderRadius: 4, fontSize: 11 }}>
                                  行政区
                                </Tag>
                              )}
                              {isPOI && (place as TiandituPOI).typeName && (
                                <Tag color="green" style={{ margin: 0, borderRadius: 4, fontSize: 11 }}>
                                  {(place as TiandituPOI).typeName}
                                </Tag>
                              )}
                            </div>
                            
                            {isPOI && (place as TiandituPOI).address && (
                              <div style={{ 
                                fontSize: 13, 
                                color: token.colorTextSecondary, 
                                marginBottom: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8
                              }}>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  {(place as TiandituPOI).address}
                                </span>
                                {distanceText && (
                                  <span style={{ 
                                    fontSize: 12, 
                                    color: '#1890ff',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {distanceText}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <div style={{ fontSize: 12, color: token.colorTextTertiary, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {isPOI && (
                                <>
                                  {(place as TiandituPOI).province && <span>{(place as TiandituPOI).province}</span>}
                                  {(place as TiandituPOI).city && <span>{(place as TiandituPOI).city}</span>}
                                  {(place as TiandituPOI).county && <span>{(place as TiandituPOI).county}</span>}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
