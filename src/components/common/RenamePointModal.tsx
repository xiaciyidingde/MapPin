import { Modal, Input } from 'antd';
import type { MeasurementPoint } from '../../types/measurement';

interface RenamePointModalProps {
  open: boolean;
  point: MeasurementPoint | null;
  newPointNumber: string;
  newCode: string;
  onPointNumberChange: (value: string) => void;
  onCodeChange: (value: string) => void;
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
  newCode,
  onPointNumberChange,
  onCodeChange,
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
        <div style={{ marginBottom: 8 }}>
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
      </div>
      <div>
        <div style={{ marginBottom: 8 }}>
          编码: {point?.code || '无'}
        </div>
        <Input
          placeholder="请输入新编码（可选）"
          value={newCode}
          onChange={(e) => onCodeChange(e.target.value)}
          onPressEnter={onConfirm}
          maxLength={50}
        />
      </div>
    </Modal>
  );
}
