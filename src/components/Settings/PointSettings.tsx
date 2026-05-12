import { useState, useMemo, useCallback } from 'react';
import { Button, Input, Dropdown, message, Checkbox, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { Virtuoso } from 'react-virtuoso';
import { useMapStore, useDataStore } from '../../store';
import { PointCard } from './PointCard';
import { RenamePointModal } from '../common/RenamePointModal';
import { usePointRename } from '../../hooks/usePointRename';
import type { MeasurementPoint } from '../../types';

type FilterType = 'all' | 'survey' | 'control' | 'manual';

export function PointSettings() {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const updatePoint = useDataStore((state) => state.updatePoint);
  const batchUpdatePoints = useDataStore((state) => state.batchUpdatePoints);
  const updateFile = useDataStore((state) => state.updateFile);
  const deletePoint = useDataStore((state) => state.deletePoint);
  const [searchText, setSearchText] = useState('');
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');

  // 使用点位重命名 Hook
  const {
    renameModalOpen,
    renamingPoint,
    newPointNumber,
    setNewPointNumber,
    openRenameModal,
    closeRenameModal,
    confirmRename,
  } = usePointRename(currentFileId);

  const currentPoints = currentFileId ? points.get(currentFileId) || [] : [];
  
  // 使用 useMemo 缓存筛选菜单
  const filterMenuItems: MenuProps['items'] = useMemo(() => [
    {
      key: 'all',
      label: '全部点位',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        setFilterType('all');
      },
    },
    {
      key: 'survey',
      label: '碎部点',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        setFilterType('survey');
      },
    },
    {
      key: 'control',
      label: '控制点',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        setFilterType('control');
      },
    },
    {
      key: 'manual',
      label: '手动点',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        setFilterType('manual');
      },
    },
  ], []);

  // 使用 useMemo 缓存筛选按钮文本
  const filterLabel = useMemo(() => {
    switch (filterType) {
      case 'survey':
        return '碎部';
      case 'control':
        return '控制';
      case 'manual':
        return '手动';
      default:
        return '全部';
    }
  }, [filterType]);
  
  // 使用 useMemo 缓存排序和过滤结果
  const sortedPoints = useMemo(() => {
    // 先按类型筛选
    const typeFiltered = currentPoints.filter((point) => {
      if (filterType === 'all') return true;
      if (filterType === 'manual') return point.isManuallyAdded === true;
      if (filterType === 'survey') return point.type === 'survey';
      if (filterType === 'control') return point.type === 'control';
      return true;
    });
    
    // 再按搜索文本过滤
    const searchFiltered = typeFiltered.filter((point) =>
      point.pointNumber.toLowerCase().includes(searchText.toLowerCase())
    );

    // 排序：控制点在前，测量点在后，每组内按 order 字段保持原始顺序
    return [...searchFiltered].sort((a, b) => {
      if (a.type === b.type) {
        return a.order - b.order;
      }
      return a.type === 'control' ? -1 : 1;
    });
  }, [currentPoints, filterType, searchText]);

  // 使用 useMemo 缓存批量操作菜单
  const batchMenuItems: MenuProps['items'] = useMemo(() => [
    {
      key: 'survey',
      label: '标记为碎部点',
      disabled: selectedPointIds.length === 0,
      onClick: () => handleBatchUpdate('survey'),
    },
    {
      key: 'control',
      label: '标记为控制点',
      disabled: selectedPointIds.length === 0,
      onClick: () => handleBatchUpdate('control'),
    },
  ], [selectedPointIds.length]);

  // 使用 useCallback 缓存批量修改函数
  const handleBatchUpdate = useCallback(async (type: 'survey' | 'control') => {
    if (!currentFileId || selectedPointIds.length === 0) return;

    const hide = message.loading(`正在批量修改 ${selectedPointIds.length} 个点...`, 0);
    
    try {
      // 批量更新（一次数据库事务）
      const updates = selectedPointIds.map(pointId => ({
        pointId,
        data: { type }
      }));
      
      await batchUpdatePoints(currentFileId, updates);
      
      // 重新计算文件的控制点和测量点数量
      const updatedPoints = currentPoints.map(p => 
        selectedPointIds.includes(p.id) ? { ...p, type } : p
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
      
      hide();
      message.success(`已将 ${selectedPointIds.length} 个点标记为${type === 'control' ? '控制点' : '碎部点'}`);
      setSelectedPointIds([]);
    } catch {
      hide();
      message.error('批量修改失败');
    }
  }, [currentFileId, selectedPointIds, currentPoints, files, batchUpdatePoints, updateFile]);

  // 使用 useCallback 缓存切换类型函数
  const handleToggleType = useCallback(async (point: MeasurementPoint) => {
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
  }, [currentFileId, currentPoints, files, updatePoint, updateFile]);

  // 使用 useCallback 缓存删除函数
  const handleDeletePoint = useCallback(async (point: MeasurementPoint) => {
    if (!currentFileId) return;
    
    try {
      await deletePoint(currentFileId, point.id);
      message.success(`已删除点 ${point.pointNumber}`);
      // 如果删除的点在选中列表中，也要移除
      setSelectedPointIds((prev) => prev.filter((id) => id !== point.id));
    } catch {
      message.error('删除失败');
    }
  }, [currentFileId, deletePoint]);

  // 使用 useCallback 缓存切换选中函数
  const handleToggleSelect = useCallback((pointId: string) => {
    setSelectedPointIds((prev) =>
      prev.includes(pointId)
        ? prev.filter((id) => id !== pointId)
        : [...prev, pointId]
    );
  }, []);

  // 使用 useCallback 缓存全选函数
  const handleSelectAll = useCallback(() => {
    if (selectedPointIds.length === sortedPoints.length) {
      setSelectedPointIds([]);
    } else {
      setSelectedPointIds(sortedPoints.map((p) => p.id));
    }
  }, [selectedPointIds.length, sortedPoints]);

  if (!currentFileId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        请先选择一个文件
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* 重命名对话框 */}
      <RenamePointModal
        open={renameModalOpen}
        point={renamingPoint}
        newPointNumber={newPointNumber}
        onPointNumberChange={setNewPointNumber}
        onConfirm={confirmRename}
        onCancel={closeRenameModal}
      />

      {/* 顶部操作区 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 600 }}>
          <Dropdown menu={{ items: filterMenuItems }} placement="bottomLeft" trigger={['click']}>
            <Button icon={<FilterOutlined />} style={{ flexShrink: 0 }}>
              {filterLabel}
            </Button>
          </Dropdown>
          <Input
            placeholder="搜索点号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ flex: 1 }}
            allowClear
          />
          <Dropdown menu={{ items: batchMenuItems }} placement="bottomRight">
            <Button style={{ flexShrink: 0 }}>
              操作 {selectedPointIds.length > 0 && `(${selectedPointIds.length})`}
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* 全选选项 */}
      {sortedPoints.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: '100%', maxWidth: 600 }}>
            <Checkbox
              checked={selectedPointIds.length === sortedPoints.length && sortedPoints.length > 0}
              indeterminate={selectedPointIds.length > 0 && selectedPointIds.length < sortedPoints.length}
              onChange={handleSelectAll}
            >
              全选 ({sortedPoints.length} 个点)
            </Checkbox>
          </div>
        </div>
      )}

      {/* 卡片列表 - 使用虚拟滚动 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {sortedPoints.length === 0 ? (
            <Empty description="没有找到匹配的点位" />
          ) : (
            <Virtuoso
              style={{ height: 'calc(100vh - 300px)' }}
              data={sortedPoints}
              itemContent={(_index, point) => (
                <div style={{ marginBottom: 12 }}>
                  <PointCard
                    point={point}
                    isSelected={selectedPointIds.includes(point.id)}
                    onToggleSelect={handleToggleSelect}
                    onToggleType={handleToggleType}
                    onOpenRename={openRenameModal}
                    onDelete={handleDeletePoint}
                  />
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
