import { Modal, Checkbox, Flex, Input } from 'antd';
import { useState, useEffect } from 'react';

interface ExportConfigModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (config: ExportConfig) => Promise<void>;
  loading?: boolean;
  mode: 'current' | 'all';
  defaultFileName?: string;
}

export interface ExportConfig {
  includeControlPoints: boolean;
  includeSurveyPoints: boolean;
  includeQualityParams: boolean;
  fileName?: string;
}

export function ExportConfigModal({
  open,
  onCancel,
  onConfirm,
  loading = false,
  mode,
  defaultFileName,
}: ExportConfigModalProps) {
  const [config, setConfig] = useState<ExportConfig>({
    includeControlPoints: true,
    includeSurveyPoints: true,
    includeQualityParams: false,
    fileName: defaultFileName,
  });

  // 当 defaultFileName 改变时更新配置
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig({
      includeControlPoints: true,
      includeSurveyPoints: true,
      includeQualityParams: false,
      fileName: defaultFileName,
    });
  }, [defaultFileName]);

  const handleConfirm = async () => {
    await onConfirm(config);
  };

  return (
    <Modal
      title="导出配置"
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="确定导出"
      cancelText="取消"
      centered
      confirmLoading={loading}
    >
      <Flex vertical gap={16} style={{ padding: '16px 0' }}>
        <div className="text-sm text-gray-600">
          请选择要导出的数据内容：
        </div>

        {mode === 'current' && (
          <div>
            <div className="text-sm text-gray-700 mb-2">文件名：</div>
            <Input
              placeholder="请输入文件名（不含扩展名）"
              value={config.fileName}
              onChange={(e) => setConfig({ ...config, fileName: e.target.value })}
              suffix=".dat"
            />
          </div>
        )}

        <Checkbox
          checked={config.includeControlPoints}
          onChange={(e) =>
            setConfig({ ...config, includeControlPoints: e.target.checked })
          }
        >
          导出控制点
        </Checkbox>

        <Checkbox
          checked={config.includeSurveyPoints}
          disabled
        >
          导出碎部点（必选）
        </Checkbox>

        <Checkbox
          checked={config.includeQualityParams}
          onChange={(e) =>
            setConfig({ ...config, includeQualityParams: e.target.checked })
          }
        >
          包含原测量数据（质量参数等，如果源文件包含）
        </Checkbox>
      </Flex>
    </Modal>
  );
}
