import { Button, Card, Flex, message, Modal } from 'antd';
import { DownloadOutlined, DeleteOutlined, InboxOutlined, DatabaseOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ExportConfigModal, type ExportConfig } from '../FileUpload/ExportConfigModal';
import { RecycleBinDrawer } from './RecycleBinDrawer';
import { useDataStore } from '../../store/useDataStore';
import { useMapStore } from '../../store/useMapStore';
import { exportFile, exportMultipleFiles } from '../../services/exportService';
import { db } from '../../db/schema';
import type { MeasurementFile, MeasurementPoint } from '../../types/measurement';

export function DataSettings() {
  const { files, loadPoints, clearRecycleBin, loadFiles } = useDataStore();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'current' | 'all'>('current');
  const [exporting, setExporting] = useState(false);

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
    Modal.confirm({
      title: '⚠️ 危险操作',
      content: (
        <div>
          <p>此操作将删除所有文件和点位数据，包括：</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>所有导入的测量文件</li>
            <li>所有点位数据</li>
            <li>回收站中的数据</li>
            <li>所有设置和配置</li>
          </ul>
          <p style={{ marginTop: 8, color: '#ff4d4f', fontWeight: 'bold' }}>
            此操作无法恢复，请谨慎操作！
          </p>
        </div>
      ),
      okText: '确认清除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          // 清除所有数据库表
          await db.files.clear();
          await db.points.clear();
          await db.recycleBin.clear();
          await db.settings.clear();
          
          // 重新加载文件列表（会变成空）
          await loadFiles();
          
          message.success('所有数据已清除');
          
          // 刷新页面以重置应用状态
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          message.error('清除失败：' + (error instanceof Error ? error.message : '未知错误'));
        }
      },
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
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
        <Flex vertical gap={16} style={{ width: '100%', maxWidth: 600 }}>
        {/* 数据导出卡片 */}
        <Card size="small">
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <DownloadOutlined style={{ fontSize: 18, color: '#1890ff' }} />
              <span className="font-semibold">数据导出</span>
            </Flex>
            <div className="text-sm text-gray-600">
              将测量数据导出为文件，方便备份和分享
            </div>
            <Flex gap={8} wrap="wrap">
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExportCurrent}
              >
                导出当前文件
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExportAll}
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
            <div className="text-sm text-gray-600">
              查看和管理已删除的文件和点位数据
            </div>
            <Flex gap={8} wrap="wrap">
              <Button icon={<EyeOutlined />} onClick={handleViewRecycleBin}>
                查看回收站
              </Button>
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleClearRecycleBin}
              >
                清空回收站
              </Button>
            </Flex>
            <div className="text-xs text-gray-500">
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
            <div className="text-sm text-gray-600">
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
