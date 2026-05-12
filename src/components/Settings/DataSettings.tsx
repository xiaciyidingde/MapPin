import { Button, Card, Flex, message, Modal, Checkbox, theme } from 'antd';
import { DownloadOutlined, DeleteOutlined, InboxOutlined, DatabaseOutlined, EyeOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ExportConfigModal, type ExportConfig } from '../FileUpload/ExportConfigModal';
import { RecycleBinDrawer } from './RecycleBinDrawer';
import { FileMergeModal } from '../FileMerge/FileMergeModal';
import { useDataStore } from '../../store/useDataStore';
import { useMapStore } from '../../store/useMapStore';
import { exportFile, exportMultipleFiles } from '../../services/exportService';
import { db } from '../../db/schema';
import type { MeasurementFile, MeasurementPoint } from '../../types/measurement';

interface DataSettingsProps {
  onCloseDrawer?: () => void;
}

export function DataSettings({ onCloseDrawer }: DataSettingsProps) {
  const { token } = theme.useToken();
  const { files, loadPoints, clearRecycleBin, loadFiles } = useDataStore();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'current' | 'all'>('current');
  const [exporting, setExporting] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [clearOptions, setClearOptions] = useState({
    files: true,
    recycleBin: true,
    settings: false,
  });

  // 打开文件合并
  const handleOpenMerge = () => {
    if (files.length < 2) {
      message.warning('至少需要 2 个文件才能合并');
      return;
    }
    setMergeModalOpen(true);
  };

  // 导出当前文件
  const handleExportCurrent = () => {
    const currentFile = files.find(f => f.id === currentFileId);
    
    if (!currentFile) {
      message.warning('没有打开的文件，请先在文件列表中选择文件');
      return;
    }
    
    setExportMode('current');
    setExportModalOpen(true);
  };

  // 导出所有文件
  const handleExportAll = () => {
    if (files.length === 0) {
      message.warning('没有可导出的文件');
      return;
    }
    
    setExportMode('all');
    setExportModalOpen(true);
  };

  // 确认导出
  const handleExportConfirm = async (config: ExportConfig) => {
    setExporting(true);
    try {
      if (exportMode === 'current') {
        // 导出当前文件
        const currentFile = files.find(f => f.id === currentFileId);
        
        if (!currentFile) {
          message.warning('没有打开的文件');
          return;
        }
        
        // 加载点位数据
        await loadPoints(currentFile.id);
        
        // 重新获取最新的 store 状态
        const currentPoints = useDataStore.getState().points;
        const filePoints = currentPoints.get(currentFile.id) || [];
        
        if (filePoints.length === 0) {
          message.warning('当前文件没有点位数据');
          return;
        }

        exportFile(currentFile, filePoints, config);
        message.success(`已导出文件：${currentFile.name}`);
      } else {
        // 导出所有文件 - 需要加载所有点位
        const filesWithPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[] }> = [];
        
        for (const file of files) {
          // 加载点位数据
          await loadPoints(file.id);
          
          // 重新获取最新的 store 状态
          const currentPoints = useDataStore.getState().points;
          const filePoints = currentPoints.get(file.id) || [];
          
          if (filePoints.length > 0) {
            filesWithPoints.push({ file, points: filePoints });
          }
        }

        if (filesWithPoints.length === 0) {
          message.warning('没有可导出的点位数据');
          return;
        }

        await exportMultipleFiles(filesWithPoints, config);
        message.success(`已导出 ${filesWithPoints.length} 个文件`);
      }
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setExporting(false);
      setExportModalOpen(false);
    }
  };

  // 查看回收站
  const handleViewRecycleBin = () => {
    setRecycleBinOpen(true);
  };

  // 清空回收站
  const handleClearRecycleBin = () => {
    Modal.confirm({
      title: '确认清空回收站',
      content: '此操作将永久删除回收站中的所有项目，无法恢复。确定要继续吗？',
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        const hide = message.loading('正在清空回收站...', 0);
        try {
          await clearRecycleBin();
          hide();
          message.success('回收站已清空');
        } catch {
          hide();
          message.error('清空失败');
        }
      },
    });
  };

  // 清除所有数据
  const handleClearAllData = () => {
    setClearDataModalOpen(true);
  };

  // 确认清除数据
  const handleConfirmClearData = async () => {
    try {
      // 根据选择清除对应数据
      if (clearOptions.files) {
        await db.files.clear();
        await db.points.clear();
      }
      
      if (clearOptions.recycleBin) {
        await db.recycleBin.clear();
      }
      
      if (clearOptions.settings) {
        await db.settings.clear();
        // 清除 localStorage 中的 Zustand 持久化数据
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('mappin-')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      // 重新加载文件列表
      await loadFiles();
      
      message.success('选中的数据已清除');
      setClearDataModalOpen(false);
      
      // 如果清除了设置，刷新页面以重置应用状态
      if (clearOptions.settings) {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      message.error('清除失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 取消清除数据
  const handleCancelClearData = () => {
    setClearDataModalOpen(false);
    // 重置选项为默认值
    setClearOptions({
      files: true,
      recycleBin: true,
      settings: false,
    });
  };

  return (
    <>
      <ExportConfigModal
        open={exportModalOpen}
        onCancel={() => !exporting && setExportModalOpen(false)}
        onConfirm={handleExportConfirm}
        loading={exporting}
        mode={exportMode}
        defaultFileName={exportMode === 'current' && currentFileId ? files.find(f => f.id === currentFileId)?.name.replace(/\.dat$/i, '') : undefined}
      />
      
      <RecycleBinDrawer
        open={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
      />

      <FileMergeModal
        open={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        onSuccess={() => {
          setMergeModalOpen(false);
          onCloseDrawer?.();
        }}
      />

      {/* 清除数据确认模态框 */}
      <Modal
        title="⚠️ 危险操作"
        open={clearDataModalOpen}
        onOk={handleConfirmClearData}
        onCancel={handleCancelClearData}
        okText="确认清除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <div>
          <p>此操作将删除选中的数据，包括：</p>
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <Checkbox 
              checked={clearOptions.files}
              onChange={(e) => setClearOptions(prev => ({ ...prev, files: e.target.checked }))}
            >
              所有导入文件和点位数据
            </Checkbox>
            <br />
            <Checkbox 
              checked={clearOptions.recycleBin}
              onChange={(e) => setClearOptions(prev => ({ ...prev, recycleBin: e.target.checked }))}
            >
              回收站数据
            </Checkbox>
            <br />
            <Checkbox 
              checked={clearOptions.settings}
              onChange={(e) => setClearOptions(prev => ({ ...prev, settings: e.target.checked }))}
            >
              设置和配置
            </Checkbox>
          </div>
          <p style={{ marginTop: 8, color: '#ff4d4f', fontWeight: 'bold' }}>
            此操作无法恢复，请谨慎操作！
          </p>
        </div>
      </Modal>
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
        <Flex vertical gap={16} style={{ width: '100%', maxWidth: 600 }}>
        {/* 文件合并卡片 */}
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <MergeCellsOutlined style={{ fontSize: 18, color: '#52c41a' }} />
              <span className="font-semibold">文件合并</span>
            </Flex>
            <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
              将多个测量文件合并为一个文件，统一管理点位数据
            </div>
            <Button 
              icon={<MergeCellsOutlined />}
              onClick={handleOpenMerge}
              disabled={files.length < 2}
            >
              合并文件
            </Button>
            {files.length < 2 && (
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                💡 至少需要 2 个文件才能合并
              </div>
            )}
          </Flex>
        </Card>

        {/* 数据导出卡片 */}
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <DownloadOutlined style={{ fontSize: 18, color: '#1890ff' }} />
              <span className="font-semibold">数据导出</span>
            </Flex>
            <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
              将测量数据导出为文件，方便备份和分享
            </div>
            <Flex gap={8}>
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExportCurrent}
                style={{ flex: 1 }}
              >
                导出当前文件
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExportAll}
                style={{ flex: 1 }}
              >
                导出所有文件
              </Button>
            </Flex>
          </Flex>
        </Card>

        {/* 回收站卡片 */}
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <InboxOutlined style={{ fontSize: 18, color: '#faad14' }} />
              <span className="font-semibold">回收站</span>
            </Flex>
            <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
              查看和管理已删除的文件和点位数据
            </div>
            <Flex gap={8}>
              <Button 
                icon={<EyeOutlined />} 
                onClick={handleViewRecycleBin}
                style={{ flex: 1 }}
              >
                查看回收站
              </Button>
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleClearRecycleBin}
                style={{ flex: 1 }}
              >
                清空回收站
              </Button>
            </Flex>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              💡 回收站最多保存 10,000 个项目
            </div>
          </Flex>
        </Card>

        {/* 数据管理卡片 */}
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <DatabaseOutlined style={{ fontSize: 18, color: '#ff4d4f' }} />
              <span className="font-semibold">数据管理</span>
            </Flex>
            <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
              清除应用中的所有数据，恢复到初始状态
            </div>
            <Button 
              danger 
              icon={<DeleteOutlined />}
              onClick={handleClearAllData}
            >
              清除所有数据
            </Button>
            <div className="text-xs text-orange-500">
              ⚠️ 此操作将删除所有文件和点位数据，无法恢复
            </div>
          </Flex>
        </Card>
        </Flex>
      </div>
    </>
  );
}
