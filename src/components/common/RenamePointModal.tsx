import { Modal, Input } from 'antd';
import type { MeasurementPoint } from '../../types/measurement';

interface RenamePointModalProps {
  open: boolean;
  point: MeasurementPoint | null;
  newPointNumber: string;
  onPointNumberChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 点位重命名 Modal 组件
 * 统一的重命名界面
 */
export function RenamePointModal({
  open,
  point,
  newPointNumber,
  onPointNumberChange,
  onConfirm,
  onCancel,
}: RenamePointModalProps) {
  return (
    <Modal
      title="重命名点位"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      centered
    >
      <div style={{ marginBottom: 16 }}>
        当前点号: {point?.pointNumber}
      </div>
      <Input
        placeholder="请输入新点号"
        value={newPointNumber}
        onChange={(e) => onPointNumberChange(e.target.value)}
        onPressEnter={onConfirm}
        maxLength={50}
        autoFocus
      />
    </Modal>
  );
}
