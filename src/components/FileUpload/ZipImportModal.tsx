import { Modal, Checkbox, Button, Flex, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';

interface ZipFileInfo {
  name: string;
  size: number;
  pointCount?: number;
}

interface ZipImportModalProps {
  open: boolean;
  files: ZipFileInfo[];
  onConfirm: (selectedFiles: string[]) => void;
  onCancel: () => void;
}

export function ZipImportModal({ open, files, onConfirm, onCancel }: ZipImportModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // 当 files 变化时重置选中状态
  useEffect(() => {
    if (open) {
      setSelectedFiles(files.map(f => f.name));
    }
  }, [files, open]);

  const handleSelectAll = () => {
    setSelectedFiles(files.map(f => f.name));
  };

  const handleDeselectAll = () => {
    setSelectedFiles([]);
  };

  const handleToggle = (fileName: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileName)
        ? prev.filter(f => f !== fileName)
        : [...prev, fileName]
    );
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      return;
    }
    onConfirm(selectedFiles);
  };

  return (
    <Modal
      title={`发现 ${files.length} 个文件`}
      open={open}
      onCancel={onCancel}
      centered
      width={500}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={selectedFiles.length === 0}
        >
          导入选中的文件 ({selectedFiles.length})
        </Button>,
      ]}
    >
      <Flex vertical gap={12}>
        <Flex gap={8}>
          <Button size="small" onClick={handleSelectAll}>
            全选
          </Button>
          <Button size="small" onClick={handleDeselectAll}>
            取消全选
          </Button>
        </Flex>

        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <Flex vertical gap={8}>
            {files.map((file) => (
              <div
                key={file.name}
                style={{
                  padding: 12,
                  border: '1px solid #d9d9d9',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: selectedFiles.includes(file.name) ? '#e6f4ff' : '#fff',
                  borderColor: selectedFiles.includes(file.name) ? '#1890ff' : '#d9d9d9',
                }}
                onClick={() => handleToggle(file.name)}
              >
                <Flex align="center" gap={12}>
                  <Checkbox
                    checked={selectedFiles.includes(file.name)}
                    onChange={() => handleToggle(file.name)}
                  />
                  <FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                  <Flex vertical style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{file.name}</span>
                    <Flex gap={8} style={{ marginTop: 4 }}>
                      <Tag color="default">{(file.size / 1024).toFixed(1)} KB</Tag>
                      {file.pointCount !== undefined && (
                        <Tag color="blue">{file.pointCount} 点</Tag>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </div>
            ))}
          </Flex>
        </div>
      </Flex>
    </Modal>
  );
}
