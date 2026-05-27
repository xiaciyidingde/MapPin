import { Tag, Button, Popconfirm, App } from 'antd';
import { SwapOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Popup } from 'react-leaflet';
import { useMapStore, useDataStore } from '../../store';
import { RenamePointModal } from '../common/RenamePointModal';
import { usePointRename } from '../../hooks/usePointRename';
import { usePointDelete } from '../../hooks/usePointDelete';
import type { MeasurementPoint } from '../../types';

function formatPointNumber(pointNumber: string, maxLength: number = 20) {
  if (pointNumber.length <= maxLength) {
    return pointNumber;
  }
  const frontChars = Math.ceil(maxLength / 2) - 2;
  const backChars = Math.floor(maxLength / 2) - 2;
  return `${pointNumber.substring(0, frontChars)}...${pointNumber.substring(pointNumber.length - backChars)}`;
}

export function PointPopup({ point }: { point: MeasurementPoint }) {
  const { message } = App.useApp();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const updatePoint = useDataStore((state) => state.updatePoint);
  const recalculateFileStats = useDataStore((state) => state.recalculateFileStats);

  const {
    renameModalOpen,
    renamingPoint,
    newPointNumber,
    newCode,
    setNewPointNumber,
    setNewCode,
    openRenameModal,
    closeRenameModal,
    confirmRename,
  } = usePointRename(currentFileId);

  const { handleDelete } = usePointDelete(currentFileId);

  const handleToggleType = async () => {
    if (!currentFileId) return;

    const newType = point.type === 'survey' ? 'control' : 'survey';
    try {
      await updatePoint(currentFileId, point.id, { type: newType });
      await recalculateFileStats(currentFileId);
      message.success(`已将点 ${point.pointNumber} 标记为${newType === 'control' ? '控制点' : '碎部点'}`);
    } catch {
      message.error('修改失败');
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

          {point.code && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 4, marginBottom: 4 }}>
              编码: {point.code}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
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
                onClick={() => openRenameModal(point)}
                style={{ width: 32, height: 28, padding: 0 }}
                title="重命名"
              />
              <Popconfirm
                title="确认删除"
                description={`确定要删除点 ${point.pointNumber} 吗？`}
                onConfirm={() => handleDelete(point.id, point.pointNumber)}
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

      <RenamePointModal
        open={renameModalOpen}
        point={renamingPoint}
        newPointNumber={newPointNumber}
        newCode={newCode}
        onPointNumberChange={setNewPointNumber}
        onCodeChange={setNewCode}
        onConfirm={confirmRename}
        onCancel={closeRenameModal}
      />
    </>
  );
}
