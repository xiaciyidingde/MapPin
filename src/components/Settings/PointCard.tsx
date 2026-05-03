import { memo, useCallback } from 'react';
import { Card, Button, Tag, Checkbox, Popconfirm } from 'antd';
import { SwapOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { MeasurementPoint } from '../../types';

interface PointCardProps {
  point: MeasurementPoint;
  isSelected: boolean;
  onToggleSelect: (pointId: string) => void;
  onToggleType: (point: MeasurementPoint) => void;
  onOpenRename: (point: MeasurementPoint) => void;
  onDelete: (point: MeasurementPoint) => void;
}

export const PointCard = memo(function PointCard({
  point,
  isSelected,
  onToggleSelect,
  onToggleType,
  onOpenRename,
  onDelete,
}: PointCardProps) {
  // 使用 useCallback 缓存事件处理函数
  const handleToggleSelect = useCallback(() => {
    onToggleSelect(point.id);
  }, [onToggleSelect, point.id]);

  const handleToggleType = useCallback(() => {
    onToggleType(point);
  }, [onToggleType, point]);

  const handleOpenRename = useCallback(() => {
    onOpenRename(point);
  }, [onOpenRename, point]);

  const handleDelete = useCallback(() => {
    onDelete(point);
  }, [onDelete, point]);

  // 格式化坐标字符串
  const coordX = `X: ${point.x.toFixed(3)}`;
  const coordY = `Y: ${point.y.toFixed(3)}`;
  const coordZ = `Z: ${point.z.toFixed(3)}`;

  return (
    <Card
      size="small"
      style={{ width: '100%' }}
      styles={{ body: { padding: '12px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* 复选框 */}
        <Checkbox
          checked={isSelected}
          onChange={handleToggleSelect}
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
                onClick={handleToggleType}
                title="切换类型"
              />
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleOpenRename}
                title="重命名"
              />
            </div>
            <Popconfirm
              title="确认删除"
              description={`确定要删除点 ${point.pointNumber} 吗？`}
              onConfirm={handleDelete}
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
});
