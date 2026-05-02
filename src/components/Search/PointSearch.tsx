import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input, Tag, Empty } from 'antd';
import { SearchOutlined, CloseCircleFilled } from '@ant-design/icons';
import { useDataStore, useMapStore } from '../../store';
import type { MeasurementPoint } from '../../types';

export function PointSearch({ disabled = false }: { disabled?: boolean }) {
  const [searchText, setSearchText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [matchedPoints, setMatchedPoints] = useState<MeasurementPoint[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const currentFileId = useMapStore((state) => state.currentFileId);
  const setView = useMapStore((state) => state.setView);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);

  // 搜索匹配 - 直接在 effect 内部获取 points，避免依赖 Map 对象
  useEffect(() => {
    if (!currentFileId) {
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
  }, [searchText, currentFileId]);

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

  // 高亮匹配文本
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
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

  return (
    <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 400, margin: '0 20px', zIndex: 11 }}>
      <Input
        placeholder={currentFileId ? "搜索点号..." : "请先选择文件"}
        prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
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
        disabled={!currentFileId || disabled}
        size="large"
        style={{
          borderRadius: 24,
          backgroundColor: 'white',
          border: '2px solid #e0e0e0',
          height: 44,
          position: 'relative',
          zIndex: 11
        }}
      />

      {/* 匹配结果列表 - 使用 Portal 渲染到 body */}
      {showResults && currentFileId && !disabled && createPortal(
        <>
          {/* 半透明遮罩层 - zIndex 低于 Header */}
          <div style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            zIndex: 999
          }} onClick={() => setShowResults(false)} />
          
          {/* 匹配框 - zIndex 低于 Header */}
          <div
            ref={resultsRef}
            style={{
              position: 'fixed',
              top: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)',
              maxWidth: 400,
              backgroundColor: 'white',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: 320,
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {matchedPoints.length === 0 ? (
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
                    color: '#8c8c8c',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa'
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
                      borderBottom: index < Math.min(matchedPoints.length, 500) - 1 ? '1px solid #f0f0f0' : 'none',
                      transition: 'all 0.2s',
                      backgroundColor: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 500, color: '#262626' }}>
                        {highlightText(point.pointNumber, searchText)}
                      </span>
                      <Tag 
                        color={point.type === 'control' ? 'red' : 'blue'} 
                        style={{ margin: 0, borderRadius: 4, fontSize: 12 }}
                      >
                        {point.type === 'control' ? '控制点' : '碎部点'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 13, color: '#8c8c8c', fontFamily: 'monospace' }}>
                      X: {point.x.toFixed(3)} Y: {point.y.toFixed(3)} Z: {point.z.toFixed(3)}
                    </div>
                  </div>
                ))}
                
                {/* 显示更多提示 */}
                {matchedPoints.length > 500 && (
                  <div style={{ 
                    padding: '12px 16px', 
                    fontSize: 12, 
                    color: '#8c8c8c',
                    textAlign: 'center',
                    backgroundColor: '#fafafa',
                    borderTop: '1px solid #f0f0f0'
                  }}>
                    还有 {matchedPoints.length - 500} 个结果未显示，请输入更多关键词缩小范围
                  </div>
                )}
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
