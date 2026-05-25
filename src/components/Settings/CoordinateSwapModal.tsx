import { Modal, Card, Checkbox, Flex, Empty, App } from 'antd';
import { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useMapStore } from '../../store/useMapStore';
import { coordinateConverter } from '../../services/coordinateConverter';
import type { MeasurementPoint } from '../../types/measurement';

interface CoordinateSwapModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CoordinateSwapModal({ open, onClose, onSuccess }: CoordinateSwapModalProps) {
  const { message } = App.useApp();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const { files, loadPoints } = useDataStore();
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // 获取当前文件
  const currentFile = files.find(f => f.id === currentFileId);

  // 加载点位数据
  useEffect(() => {
    if (!open || !currentFileId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        await loadPoints(currentFileId);
        // 直接从 store 获取最新数据
        const filePoints = useDataStore.getState().points.get(currentFileId) || [];
        setPoints(filePoints);
        // 默认全选
        setSelectedPoints(new Set(filePoints.map(p => p.id)));
      } catch {
        message.error('加载点位数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFileId]); // loadPoints 和 message 是稳定的，不需要作为依赖

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPoints(new Set(points.map(p => p.id)));
    } else {
      setSelectedPoints(new Set());
    }
  };

  // 切换单个点的选择状态
  const handleTogglePoint = (pointId: string) => {
    const newSelected = new Set(selectedPoints);
    if (newSelected.has(pointId)) {
      newSelected.delete(pointId);
    } else {
      newSelected.add(pointId);
    }
    setSelectedPoints(newSelected);
  };

  // 执行坐标反转
  const handleSwap = async () => {
    if (selectedPoints.size === 0) {
      message.warning('请至少选择一个点位');
      return;
    }

    if (!currentFileId || !currentFile) {
      message.error('未找到当前文件');
      return;
    }

    setSwapping(true);
    try {
      const { batchUpdatePoints, loadPoints: reloadPoints } = useDataStore.getState();
      
      // 准备批量更新数据
      const updates = points
        .filter(p => selectedPoints.has(p.id))
        .map(point => {
          // 交换 X 和 Y
          const newX = point.y;
          const newY = point.x;
          
          // 重新计算经纬度
          const { lat, lng } = coordinateConverter.projectToWGS84(
            newX,
            newY,
            currentFile.projectionConfig.coordinateSystem,
            currentFile.projectionConfig.projectionType,
            currentFile.projectionConfig.centralMeridian
          );
          
          return {
            pointId: point.id,
            data: {
              x: newX,
              y: newY,
              lat,
              lng,
            }
          };
        });

      // 执行批量更新
      await batchUpdatePoints(currentFileId, updates);
      
      // 重新加载点位数据以确保主界面更新
      await reloadPoints(currentFileId);
      
      message.success(`已成功反转 ${updates.length} 个点位的坐标`);
      
      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      message.error('坐标反转失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setSwapping(false);
    }
  };

  return (
    <Modal
      title="坐标反转"
      open={open}
      onCancel={onClose}
      onOk={handleSwap}
      okText="反转坐标"
      cancelText="取消"
      confirmLoading={swapping}
      width={800}
      centered
      styles={{
        body: { maxHeight: '60vh', overflow: 'auto' }
      }}
    >
      {!currentFileId ? (
        <Empty description="请先打开一个文件" />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : points.length === 0 ? (
        <Empty description="当前文件没有点位数据" />
      ) : (
        <Flex vertical gap={12}>
          {/* 文件名显示 */}
          <Card size="small" style={{ backgroundColor: '#fafafa' }}>
            <Flex align="center" gap={8}>
              <span style={{ color: '#666' }}>当前文件：</span>
              <span style={{ fontWeight: 'bold' }}>{currentFile?.name}</span>
            </Flex>
          </Card>

          {/* 全选控制 */}
          <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
            <Flex justify="space-between" align="center">
              <Checkbox
                checked={selectedPoints.size === points.length}
                indeterminate={selectedPoints.size > 0 && selectedPoints.size < points.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                <span style={{ fontWeight: 'bold' }}>
                  全选 ({selectedPoints.size}/{points.length})
                </span>
              </Checkbox>
              <span style={{ fontSize: 12, color: '#666' }}>
                选中的点位将交换 X 和 Y 坐标
              </span>
            </Flex>
          </Card>

          {/* 点位列表 */}
          {points.map((point) => (
            <Card
              key={point.id}
              size="small"
              hoverable
              onClick={() => handleTogglePoint(point.id)}
              style={{
                cursor: 'pointer',
                borderColor: selectedPoints.has(point.id) ? '#1890ff' : undefined,
                backgroundColor: selectedPoints.has(point.id) ? '#e6f7ff' : undefined,
              }}
            >
              <Flex gap={12} align="center">
                <Checkbox
                  checked={selectedPoints.has(point.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => handleTogglePoint(point.id)}
                />
                <Flex vertical style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                    {point.pointNumber}
                    {point.code && (
                      <span style={{ marginLeft: 8, color: '#666', fontWeight: 'normal' }}>
                        ({point.code})
                      </span>
                    )}
                  </div>
                  <Flex gap={16} style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    <span>X: {point.x.toFixed(3)}</span>
                    <span>Y: {point.y.toFixed(3)}</span>
                    <span>Z: {point.z.toFixed(3)}</span>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Modal>
  );
}
