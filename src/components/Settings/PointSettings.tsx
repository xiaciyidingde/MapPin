import { useState } from 'react';
import { Card, Button, Tag, Input, Dropdown, Space, message, Checkbox, Empty, Popconfirm, Modal } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, DeleteOutlined, SwapOutlined, EditOutlined, FilterOutlined } from '@ant-design/icons';
import { useMapStore, useDataStore } from '../../store';
import type { MeasurementPoint } from '../../types';
import { isValidPointNumber } from '../../utils/sanitize';

type FilterType = 'all' | 'survey' | 'control' | 'manual';

export function PointSettings() {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const updatePoint = useDataStore((state) => state.updatePoint);
  const updateFile = useDataStore((state) => state.updateFile);
  const deletePoint = useDataStore((state) => state.deletePoint);
  const [searchText, setSearchText] = useState('');
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingPoint, setRenamingPoint] = useState<MeasurementPoint | null>(null);
  const [newPointNumber, setNewPointNumber] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const currentPoints = currentFileId ? points.get(currentFileId) || [] : [];
  
  // 筛选菜单
  const filterMenuItems: MenuProps['items'] = [
    {
      key: 'all',
      label: '全部点位',
      onClick: () => setFilterType('all'),
    },
    {
      key: 'survey',
      label: '碎部点',
      onClick: () => setFilterType('survey'),
    },
    {
      key: 'control',
      label: '控制点',
      onClick: () => setFilterType('control'),
    },
    {
      key: 'manual',
      label: '手动点',
      onClick: () => setFilterType('manual'),
    },
  ];

  // 获取筛选按钮文本
  const getFilterLabel = () => {
    switch (filterType) {
      case 'survey':
        return '碎部点';
      case 'control':
        return '控制点';
      case 'manual':
        return '手动点';
      default:
        return '全部';
    }
  };
  
  // 先按类型筛选
  const typeFilteredPoints = currentPoints.filter((point) => {
    if (filterType === 'all') return true;
    if (filterType === 'manual') return point.isManuallyAdded === true;
    if (filterType === 'survey') return point.type === 'survey';
    if (filterType === 'control') return point.type === 'control';
    return true;
  });
  
  // 再按搜索文本过滤
  const filteredPoints = typeFilteredPoints.filter((point) =>
    point.pointNumber.toLowerCase().includes(searchText.toLowerCase())
  );

  // 排序：控制点在前，测量点在后，每组内按 order 字段保持原始顺序
  const sortedPoints = [...filteredPoints].sort((a, b) => {
    if (a.type === b.type) {
      // 同类型按 order 排序
      return a.order - b.order;
    }
    // 控制点在前
    return a.type === 'control' ? -1 : 1;
  });

  // 批量操作菜单
  const batchMenuItems: MenuProps['items'] = [
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
  ];

  // 批量修改类型
  const handleBatchUpdate = async (type: 'survey' | 'control') => {
    if (!currentFileId || selectedPointIds.length === 0) return;

    try {
      for (const pointId of selectedPointIds) {
        await updatePoint(currentFileId, pointId, { type });
      }
      
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
      
      message.success(`已将 ${selectedPointIds.length} 个点标记为${type === 'control' ? '控制点' : '碎部点'}`);
      setSelectedPointIds([]);
    } catch {
      message.error('批量修改失败');
    }
  };

  // 单个点切换类型
  const handleToggleType = async (point: MeasurementPoint) => {
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

  // 删除单个点
  const handleDeletePoint = async (point: MeasurementPoint) => {
    if (!currentFileId) return;
    
    try {
      await deletePoint(currentFileId, point.id);
      message.success(`已删除点 ${point.pointNumber}`);
      // 如果删除的点在选中列表中，也要移除
      setSelectedPointIds((prev) => prev.filter((id) => id !== point.id));
    } catch {
      message.error('删除失败');
    }
  };

  // 打开重命名对话框
  const handleOpenRename = (point: MeasurementPoint) => {
    setRenamingPoint(point);
    setNewPointNumber(point.pointNumber);
    setRenameModalOpen(true);
  };

  // 确认重命名
  const handleConfirmRename = async () => {
    if (!currentFileId || !renamingPoint) return;
    
    const trimmedName = newPointNumber.trim();
    
    if (!trimmedName) {
      message.error('点号不能为空');
      return;
    }
    
    // 验证点号格式
    if (!isValidPointNumber(trimmedName)) {
      message.error('点号格式不正确，只允许字母、数字、中文、下划线和连字符');
      return;
    }
    
    if (trimmedName === renamingPoint.pointNumber) {
      setRenameModalOpen(false);
      return;
    }
    
    // 检查点号是否已存在
    const existingPoint = currentPoints.find(
      p => p.pointNumber === trimmedName && p.id !== renamingPoint.id
    );
    
    if (existingPoint) {
      message.error(`点号 ${trimmedName} 已存在`);
      return;
    }
    
    try {
      await updatePoint(currentFileId, renamingPoint.id, { pointNumber: trimmedName });
      message.success(`已将点号 ${renamingPoint.pointNumber} 重命名为 ${trimmedName}`);
      setRenameModalOpen(false);
      setRenamingPoint(null);
      setNewPointNumber('');
    } catch {
      message.error('重命名失败');
    }
  };

  // 切换选中状态
  const handleToggleSelect = (pointId: string) => {
    setSelectedPointIds((prev) =>
      prev.includes(pointId)
        ? prev.filter((id) => id !== pointId)
        : [...prev, pointId]
    );
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedPointIds.length === sortedPoints.length) {
      setSelectedPointIds([]);
    } else {
      setSelectedPointIds(sortedPoints.map((p) => p.id));
    }
  };

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
      <Modal
        title="重命名点位"
        open={renameModalOpen}
        onOk={handleConfirmRename}
        onCancel={() => {
          setRenameModalOpen(false);
          setRenamingPoint(null);
          setNewPointNumber('');
        }}
        okText="确认"
        cancelText="取消"
        centered
      >
        <div style={{ marginTop: 16 }}>
          {renamingPoint?.originalPointNumber && renamingPoint.originalPointNumber !== renamingPoint.pointNumber && (
            <div style={{ marginBottom: 8, color: '#999', fontSize: 13 }}>
              原始点号: {renamingPoint.originalPointNumber}
            </div>
          )}
          <div style={{ marginBottom: 8, color: '#666' }}>
            当前点号: {renamingPoint?.pointNumber}
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

      {/* 顶部操作区 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 600 }}>
          <Dropdown menu={{ items: filterMenuItems }} placement="bottomLeft">
            <Button icon={<FilterOutlined />} style={{ flexShrink: 0 }}>
              {getFilterLabel()}
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

      {/* 卡片列表 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {sortedPoints.length === 0 ? (
            <Empty description="没有找到匹配的点位" />
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {sortedPoints.map((point) => {
            // 格式化坐标字符串
            const coordX = `X: ${point.x.toFixed(3)}`;
            const coordY = `Y: ${point.y.toFixed(3)}`;
            const coordZ = `Z: ${point.z.toFixed(3)}`;
            
            return (
              <Card
                key={point.id}
                size="small"
                style={{ width: '100%' }}
                styles={{ body: { padding: '12px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* 复选框 */}
                  <Checkbox
                    checked={selectedPointIds.includes(point.id)}
                    onChange={() => handleToggleSelect(point.id)}
                    style={{ marginTop: 2 }}
                  />

                  {/* 点位信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 点号和类型 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ 
                          fontWeight: 500, 
                          fontSize: 15, 
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-all'
                        }}>
                          {point.pointNumber}
                        </span>
                        {point.isManuallyAdded && (
                          <span style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0 }}>
                            手动添加
                          </span>
                        )}
                      </div>
                      <Tag color={point.type === 'control' ? 'red' : 'blue'} style={{ flexShrink: 0, marginTop: 2 }}>
                        {point.type === 'control' ? '控制点' : '碎部点'}
                      </Tag>
                    </div>
                    
                    {/* 编码 - 单独一行 */}
                    {point.code && (
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                        编码: {point.code}
                      </div>
                    )}
                    
                    {/* 原始点号 - 单独一行 */}
                    {point.originalPointNumber && point.originalPointNumber !== point.pointNumber && (
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                        原名: {point.originalPointNumber}
                      </div>
                    )}

                    {/* 坐标信息 - 智能换行 */}
                    <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span style={{ whiteSpace: 'nowrap' }}>{coordX}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{coordY}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{coordZ}</span>
                      </div>
                    </div>

                    {/* 精度信息 - 如果有才显示 */}
                    {point.qualityParams && (point.qualityParams.hrms !== undefined || point.qualityParams.vrms !== undefined) && (
                      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {point.qualityParams.hrms !== undefined && (
                            (() => {
                              const hrms = typeof point.qualityParams.hrms === 'number' 
                                ? point.qualityParams.hrms 
                                : parseFloat(String(point.qualityParams.hrms));
                              return !isNaN(hrms) && (
                                <span style={{ 
                                  whiteSpace: 'nowrap',
                                  color: hrms > 0.05 ? '#ff4d4f' : '#666'
                                }}>
                                  水平精度: {hrms.toFixed(3)}m
                                </span>
                              );
                            })()
                          )}
                          {point.qualityParams.vrms !== undefined && (
                            (() => {
                              const vrms = typeof point.qualityParams.vrms === 'number' 
                                ? point.qualityParams.vrms 
                                : parseFloat(String(point.qualityParams.vrms));
                              return !isNaN(vrms) && (
                                <span style={{ 
                                  whiteSpace: 'nowrap',
                                  color: vrms > 0.05 ? '#ff4d4f' : '#666'
                                }}>
                                  垂直精度: {vrms.toFixed(3)}m
                                </span>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="small"
                          icon={<SwapOutlined />}
                          onClick={() => handleToggleType(point)}
                          title="切换类型"
                        />
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenRename(point)}
                          title="重命名"
                        />
                      </div>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除点 ${point.pointNumber} 吗？`}
                        onConfirm={() => handleDeletePoint(point)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          title="删除"
                        />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </Space>
          )}
        </div>
      </div>
    </div>
  );
}
