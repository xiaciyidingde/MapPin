import { useState } from 'react';
import { Button, Tag, Popconfirm, Empty, Card, Flex, Input, message } from 'antd';
import { DeleteOutlined, FileTextOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { useDataStore } from '../../store';
import { useMapStore } from '../../store';
import { ProjectionConfigModal } from './ProjectionConfigModal';
import { useFileNameValidation } from '../../hooks/useFileNameValidation';
import type { MeasurementFile, ProjectionConfig } from '../../types';

interface FileListProps {
  onOpenSettings?: (fileId: string) => void;
  onFileSelect?: () => void; // 文件被选中时的回调
}

export function FileList({ onOpenSettings, onFileSelect }: FileListProps) {
  const files = useDataStore((state) => state.files);
  const deleteFile = useDataStore((state) => state.deleteFile);
  const addFile = useDataStore((state) => state.addFile);
  const currentFileId = useMapStore((state) => state.currentFileId);
  const setCurrentFileId = useMapStore((state) => state.setCurrentFileId);
  const triggerFitToView = useMapStore((state) => state.triggerFitToView);
  
  // 使用文件名验证 Hook
  const { validateFileName } = useFileNameValidation();
  
  const [newFileName, setNewFileName] = useState('');
  const [creating, setCreating] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [pendingFileName, setPendingFileName] = useState('');

  const handleFileClick = (fileId: string) => {
    setCurrentFileId(fileId);
    // 延迟触发 Fit to View
    setTimeout(() => {
      triggerFitToView();
    }, 100);
    // 通知父组件文件已被选中
    onFileSelect?.();
  };

  const handleDelete = async (fileId: string) => {
    await deleteFile(fileId);
    if (currentFileId === fileId) {
      setCurrentFileId(null);
    }
  };

  // 创建新文件 - 验证文件名并打开配置窗口
  const handleCreateFile = () => {
    // 使用 Hook 验证文件名
    const finalFileName = validateFileName(newFileName);
    if (!finalFileName) return;
    
    // 检查文件名是否已存在
    const existingFile = files.find(f => f.name === finalFileName || f.name === `${finalFileName}.dat`);
    if (existingFile) {
      message.error(`文件名 "${finalFileName}" 已存在`);
      return;
    }
    
    // 保存文件名并打开配置窗口
    setPendingFileName(finalFileName);
    setConfigModalOpen(true);
  };
  
  // 创建新文件 - 用户确认配置后创建
  const handleConfirmCreate = async (config: ProjectionConfig, customFileName?: string) => {
    setCreating(true);
    setConfigModalOpen(false);
    
    try {
      // 优先使用配置窗口中修改的文件名，否则使用原始输入的文件名
      const finalFileName = customFileName || pendingFileName;
      
      // 确保文件名有 .dat 扩展名
      const fileNameWithExt = finalFileName.endsWith('.dat') 
        ? finalFileName 
        : `${finalFileName}.dat`;
      
      // 创建新文件对象
      const newFile: MeasurementFile = {
        id: uuidv4(),
        name: fileNameWithExt,
        uploadTime: Date.now(),
        format: 'simple',
        coordinateSystem: config.coordinateSystem,
        pointCount: 0,
        controlPointCount: 0,
        surveyPointCount: 0,
        projectionConfig: config,
      };
      
      // 添加文件
      await addFile(newFile, []);
      
      // 自动打开新创建的文件
      setCurrentFileId(newFile.id);
      
      message.success(`已创建文件 "${fileNameWithExt}"`);
      setNewFileName('');
      setPendingFileName('');
      
      // 通知父组件文件已被选中
      onFileSelect?.();
    } catch (error) {
      console.error('创建文件失败:', error);
      message.error('创建文件失败');
    } finally {
      setCreating(false);
    }
  };
  
  // 取消创建
  const handleCancelCreate = () => {
    setConfigModalOpen(false);
    setPendingFileName('');
  };

  // 只在没有打开文件时显示创建文件输入框
  const showCreateInput = !currentFileId;
  
  // 关闭当前文件
  const handleCloseFile = () => {
    setCurrentFileId(null);
  };

  return (
    <Flex vertical gap={12} style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
      {/* 关闭当前文件按钮 - 只在打开文件时显示 */}
      {currentFileId && (
        <Button
          type="default"
          danger
          onClick={handleCloseFile}
          block
        >
          关闭当前文件
        </Button>
      )}
      
      {/* 创建文件输入框 - 只在没有打开文件时显示 */}
      {showCreateInput && (
        <Card size="small" style={{ backgroundColor: '#f0f9ff', borderColor: '#91caff' }}>
          <Flex gap={8} align="center">
            <Input
              placeholder="输入文件名创建新文件"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onPressEnter={handleCreateFile}
              disabled={creating}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateFile}
              loading={creating}
            >
              创建
            </Button>
          </Flex>
        </Card>
      )}
      
      {files.length === 0 ? (
        <Empty
          description="暂无文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        files.map((file: MeasurementFile) => (
          <Card
            key={file.id}
            size="small"
            className={`cursor-pointer hover:shadow-md transition-all ${
              currentFileId === file.id ? 'border-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => handleFileClick(file.id)}
          >
            <Flex justify="space-between" align="start">
              <Flex gap={12} align="start" style={{ flex: 1, minWidth: 0 }}>
                <FileTextOutlined className="text-2xl text-blue-500 mt-1" style={{ flexShrink: 0 }} />
                <Flex vertical gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                    <span className="font-medium" style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0
                    }}>{file.name}</span>
                    {currentFileId === file.id && (
                      <Tag color="blue" style={{ flexShrink: 0 }}>当前</Tag>
                    )}
                  </Flex>
                  <div className="text-xs text-gray-500">
                    上传时间：{dayjs(file.uploadTime).format('YYYY-MM-DD HH:mm')}
                  </div>
                  <Flex gap={8} wrap="wrap">
                    <Tag color="default">总计 {file.pointCount}</Tag>
                    <Tag color="red">控制点 {file.controlPointCount}</Tag>
                    <Tag color="blue">碎部点 {file.surveyPointCount}</Tag>
                  </Flex>
                </Flex>
              </Flex>
              
              {/* 右侧按钮组 */}
              <Flex vertical gap={4} style={{ flexShrink: 0, marginLeft: 8 }}>
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSettings?.(file.id);
                  }}
                  title="文件设置"
                  style={{ fontSize: '18px' }}
                />
                <Popconfirm
                  title="确认删除"
                  description="删除后文件将移至回收站"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDelete(file.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    title="删除文件"
                    style={{ fontSize: '18px' }}
                  />
                </Popconfirm>
              </Flex>
            </Flex>
          </Card>
        ))
      )}
      
      {/* 投影配置窗口 */}
      <ProjectionConfigModal
        open={configModalOpen}
        fileName={pendingFileName}
        onConfirm={handleConfirmCreate}
        onCancel={handleCancelCreate}
        okText="创建"
      />
    </Flex>
  );
}
