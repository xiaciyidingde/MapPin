import { Modal, Steps, Button, Space } from 'antd';
import type { ReactNode } from 'react';

interface MultiStepModalProps {
  open: boolean;
  title: string;
  currentStep: number;
  steps: Array<{
    title: string;
    content?: string;
  }>;
  children: ReactNode;
  onCancel: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  nextButtonText?: string;
  finishButtonText?: string;
  nextButtonDisabled?: boolean;
  finishButtonDisabled?: boolean;
  loading?: boolean;
  width?: number;
}

/**
 * 通用的多步骤 Modal 组件
 * 提供统一的步骤导航和按钮布局
 */
export function MultiStepModal({
  open,
  title,
  currentStep,
  steps,
  children,
  onCancel,
  onPrev,
  onNext,
  onFinish,
  nextButtonText = '下一步',
  finishButtonText = '完成',
  nextButtonDisabled = false,
  finishButtonDisabled = false,
  loading = false,
  width = 800,
}: MultiStepModalProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={width}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          {!isFirstStep && onPrev && (
            <Button onClick={onPrev} disabled={loading}>
              上一步
            </Button>
          )}
          {!isLastStep && onNext && (
            <Button
              type="primary"
              onClick={onNext}
              disabled={nextButtonDisabled}
              loading={loading}
            >
              {nextButtonText}
            </Button>
          )}
          {isLastStep && onFinish && (
            <Button
              type="primary"
              onClick={onFinish}
              disabled={finishButtonDisabled}
              loading={loading}
            >
              {finishButtonText}
            </Button>
          )}
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        {/* 步骤指示器 */}
        <Steps current={currentStep} items={steps} responsive={false} />

        {/* 步骤内容 */}
        <div style={{ minHeight: 300 }}>{children}</div>
      </div>
    </Modal>
  );
}
