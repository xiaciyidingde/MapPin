import { Modal, Checkbox, Input, Radio, Space, Alert, Typography, Flex, Steps, Button, Card, theme, App } from 'antd';
import { useState, useMemo, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useMapStore } from '../../store/useMapStore';
import { exportFile, exportMultipleFiles, type ExportOptions } from '../../services/exportService';
import { useFileNameValidation } from '../../hooks/useFileNameValidation';
import { useScrollToElement } from '../../hooks/useScrollToElement';
import { loadAndGetPoints } from '../../utils/dataUtils';
import { generateDefaultFileName } from '../../utils/fileUtils';
import type { MeasurementFile, MeasurementPoint } from '../../types/measurement';
const { Text } = Typography;

interface FileExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function FileExportModal({ open, onClose }: FileExportModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { files, loadPoints } = useDataStore();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const { validateFileName } = useFileNameValidation();
  
  // 默认选中当前打开的文件
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>(
    currentFileId ? [currentFileId] : []
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [exporting, setExporting] = useState(false);
  
  // 使用滚动 Hook
  const { containerRef, getTargetRef } = useScrollToElement({
    targetKeys: currentFileId ? [currentFileId] : [],
    enabled: open,
    delay: 500,
    block: 'center',
  });
  
  // 导出配置
  const [exportConfig, setExportConfig] = useState({
    format: 'simple' as 'simple' | 'detailed',
    includeControl: true,
    includeSurvey: true,
    includeManual: false,
    swapXY: false,
  });
  
  // 文件名
  const [exportFileName, setExportFileName] = useState('');

  // 每次打开时重置状态
  useEffect(() => {
    if (open) {
      // 使用 queueMicrotask 避免同步 setState
      queueMicrotask(() => {
        setSelectedFileIds(currentFileId ? [currentFileId] : []);
        setCurrentStep(0);
        setExporting(false);
        setExportConfig({
          format: 'simple',
          includeControl: true,
          includeSurvey: true,
          includeManual: false,
          swapXY: false,
        });
        
        // 设置默认文件名
        setExportFileName(generateDefaultFileName(currentFileId, files));
      });
    }
  }, [open, currentFileId, files]);

  // 获取选中的文件信息 - 使用 Map 优化查找性能
  const selectedFiles = useMemo(() => {
    const fileMap = new Map(files.map(f => [f.id, f]));
    return selectedFileIds.map(id => fileMap.get(id)).filter(Boolean) as MeasurementFile[];
  }, [files, selectedFileIds]);

  // 统计信息
  const stats = useMemo(() => {
    const totalPoints = selectedFiles.reduce((sum, f) => sum + f.pointCount, 0);
    return {
      fileCount: selectedFiles.length,
      totalPoints,
    };
  }, [selectedFiles]);

  // 单个文件选择
  const handleCheckFile = (fileId: string, checked: boolean) => {
    setSelectedFileIds(prev => {
      if (checked) {
        return [...prev, fileId];
      } else {
        return prev.filter(id => id !== fileId);
      }
    });
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFileIds(files.map(f => f.id));
    } else {
      setSelectedFileIds([]);
    }
  };

  // 下一步
  const handleNext = () => {
    if (currentStep < 2) {
      // 如果从步骤1进入步骤2，更新文件名
      if (currentStep === 0) {
        const fileId = selectedFileIds.length === 1 ? selectedFileIds[0] : null;
        setExportFileName(generateDefaultFileName(fileId, files));
      }
      setCurrentStep(currentStep + 1);
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 确认导出
  const handleExport = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }

    // 验证文件名
    const finalFileName = validateFileName(exportFileName);
    if (!finalFileName) return;

    setExporting(true);
    try {
      // 准备导出选项
      const options: ExportOptions = {
        format: exportConfig.format,
        includeControl: exportConfig.includeControl,
        includeSurvey: exportConfig.includeSurvey,
        includeManual: exportConfig.includeManual,
        swapXY: exportConfig.swapXY,
      };

      if (selectedFileIds.length === 1) {
        // 单文件导出
        const fileId = selectedFileIds[0];
        const file = files.find(f => f.id === fileId);
        
        if (!file) {
          message.error('文件不存在');
          return;
        }

        // 加载点位数据
        const points = await loadAndGetPoints(fileId, loadPoints);

        if (points.length === 0) {
          message.warning('当前文件没有点位数据');
          return;
        }

        // 导出文件
        exportFile(file, points, options, finalFileName);
        message.success(`已导出文件：${finalFileName}.dat`);
      } else {
        // 多文件导出
        const filesWithPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[] }> = [];
        
        for (const fileId of selectedFileIds) {
          const file = files.find(f => f.id === fileId);
          if (!file) continue;

          // 加载点位数据
          const points = await loadAndGetPoints(fileId, loadPoints);
          
          if (points.length > 0) {
            filesWithPoints.push({ file, points });
          }
        }

        if (filesWithPoints.length === 0) {
          message.warning('没有可导出的点位数据');
          return;
        }

        // 导出为 ZIP
        await exportMultipleFiles(filesWithPoints, options, finalFileName);
        message.success(`已导出 ${filesWithPoints.length} 个文件`);
      }
      
      onClose();
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  // 取消
  const handleCancel = () => {
    if (!exporting) {
      onClose();
    }
  };

  // 步骤配置
  const steps = [
    { title: '选择' },
    { title: '配置' },
    { title: '确认' },
  ];

  // 当前步骤是否可以进入下一步
  const canNext = () => {
    if (currentStep === 0) {
      return selectedFileIds.length > 0;
    }
    if (currentStep === 1) {
      // 至少选择一种点位类型
      return exportConfig.includeControl || exportConfig.includeSurvey || exportConfig.includeManual;
    }
    return true;
  };

  return (
    <Modal
      title="数据导出"
      open={open}
      onCancel={handleCancel}
      width="90%"
      style={{ maxWidth: 680 }}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* 步骤指示器 */}
        <Steps
          current={currentStep}
          items={steps}
          style={{ marginTop: 16 }}
          size="small"
          responsive={false}
        />

        {/* 步骤内容 */}
        <div style={{ minHeight: 320 }}>
          {/* 步骤 1: 选择文件 */}
          {currentStep === 0 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <Text strong>选择要导出的文件</Text>
                <Checkbox
                  checked={selectedFileIds.length === files.length && files.length > 0}
                  indeterminate={selectedFileIds.length > 0 && selectedFileIds.length < files.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                >
                  全选
                </Checkbox>
              </Flex>
              
              <div
                ref={containerRef}
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: 8,
                  padding: 16,
                  backgroundColor: token.colorFillAlter,
                }}
              >
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {files.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: token.colorTextSecondary }}>
                      暂无文件
                    </div>
                  ) : (
                    files.map(file => (
                      <div
                        key={file.id}
                        ref={getTargetRef(file.id)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: selectedFileIds.includes(file.id) ? token.colorPrimaryBg : token.colorBgContainer,
                          borderRadius: 6,
                          border: selectedFileIds.includes(file.id) ? `1px solid ${token.colorPrimaryBorder}` : `1px solid ${token.colorBorder}`,
                          transition: 'all 0.3s',
                        }}
                      >
                        <Checkbox
                          checked={selectedFileIds.includes(file.id)}
                          onChange={(e) => handleCheckFile(file.id, e.target.checked)}
                          style={{ width: '100%' }}
                        >
                          <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                            <Text>{file.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {file.pointCount} 个点位
                            </Text>
                          </Flex>
                        </Checkbox>
                      </div>
                    ))
                  )}
                </Space>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: token.colorPrimaryBg,
                  borderRadius: 8,
                  border: `1px solid ${token.colorPrimaryBorder}`,
                }}
              >
                <Text style={{ fontSize: 13 }}>
                  已选择 <Text strong style={{ color: '#1890ff' }}>{stats.fileCount}</Text> 个文件，
                  共 <Text strong style={{ color: '#1890ff' }}>{stats.totalPoints}</Text> 个点位
                </Text>
              </div>
            </Space>
          )}

          {/* 步骤 2: 导出选项 */}
          {currentStep === 1 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" title="文件内容">
                <Radio.Group
                  value={exportConfig.format}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, format: e.target.value }))}
                >
                  <Space orientation="vertical">
                    <Radio value="simple">
                      <Space orientation="vertical" size={0}>
                        <Text>简单格式</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          点号、编码、X、Y、Z
                        </Text>
                      </Space>
                    </Radio>
                    <Radio value="detailed">
                      <Space orientation="vertical" size={0}>
                        <Text>详细格式</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          包含点类型、坐标系统、经纬度等完整信息
                        </Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Card>

              <Card size="small" title="点位类型">
                <Space orientation="vertical">
                  <Checkbox
                    checked={exportConfig.includeControl}
                    onChange={(e) => {
                      setExportConfig(prev => ({ ...prev, includeControl: e.target.checked }));
                    }}
                  >
                    控制点
                  </Checkbox>
                  <Checkbox
                    checked={exportConfig.includeSurvey}
                    onChange={(e) => {
                      setExportConfig(prev => ({ ...prev, includeSurvey: e.target.checked }));
                    }}
                  >
                    碎步点
                  </Checkbox>
                  <Checkbox
                    checked={exportConfig.includeManual}
                    onChange={(e) => {
                      setExportConfig(prev => ({ ...prev, includeManual: e.target.checked }));
                    }}
                  >
                    手动添加点
                  </Checkbox>
                </Space>
              </Card>

              <Card size="small" title="坐标选项">
                <Checkbox
                  checked={exportConfig.swapXY}
                  onChange={(e) => {
                    setExportConfig(prev => ({ ...prev, swapXY: e.target.checked }));
                  }}
                >
                  <Space orientation="vertical" size={0}>
                    <Text>交换 X/Y 坐标</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      导出时将 X 和 Y 坐标值互换
                    </Text>
                  </Space>
                </Checkbox>
              </Card>
            </Space>
          )}

          {/* 步骤 3: 确认导出 */}
          {currentStep === 2 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                title="确认导出信息"
                description="请检查以下信息，确认无误后点击导出按钮"
                type="info"
                showIcon
              />

              <div
                style={{
                  padding: 20,
                  backgroundColor: token.colorFillAlter,
                  borderRadius: 8,
                  border: `1px solid ${token.colorBorder}`,
                }}
              >
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                  {/* 文件名 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                      {selectedFileIds.length === 1 ? '导出文件名' : '导出文件名（将导出为ZIP压缩包）'}
                    </Text>
                    <Input
                      value={exportFileName}
                      onChange={(e) => setExportFileName(e.target.value)}
                      placeholder="请输入文件名"
                      maxLength={50}
                      suffix={selectedFileIds.length === 1 ? '.dat' : '.zip'}
                      size="large"
                    />
                  </div>

                  {/* 导出摘要 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                      导出摘要
                    </Text>
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: token.colorBgContainer,
                        borderRadius: 6,
                        border: `1px solid ${token.colorBorder}`,
                      }}
                    >
                      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                        <Text style={{ fontSize: 13 }}>
                          文件数量：<Text strong>{stats.fileCount}</Text>
                        </Text>
                        <Text style={{ fontSize: 13 }}>
                          点位总数：<Text strong>{stats.totalPoints}</Text>
                        </Text>
                        <Text style={{ fontSize: 13 }}>
                          文件格式：<Text strong>{exportConfig.format === 'simple' ? '简单格式' : '详细格式'}</Text>
                        </Text>
                        <Text style={{ fontSize: 13 }}>
                          点位类型：<Text strong>
                            {[
                              exportConfig.includeControl && '控制点',
                              exportConfig.includeSurvey && '碎步点',
                              exportConfig.includeManual && '手动添加点'
                            ].filter(Boolean).join('、')}
                          </Text>
                        </Text>
                        {exportConfig.swapXY && (
                          <Text style={{ fontSize: 13 }}>
                            坐标选项：<Text strong style={{ color: '#fa8c16' }}>已启用 X/Y 交换</Text>
                          </Text>
                        )}
                      </Space>
                    </div>
                  </div>
                </Space>
              </div>
            </Space>
          )}
        </div>

        {/* 底部按钮 */}
        <Flex justify="space-between" style={{ marginTop: 8 }}>
          <Button onClick={handleCancel} disabled={exporting}>
            取消
          </Button>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev} disabled={exporting}>
                上一步
              </Button>
            )}
            {currentStep < 2 ? (
              <Button type="primary" onClick={handleNext} disabled={!canNext()}>
                下一步
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleExport}
                loading={exporting}
                disabled={selectedFileIds.length === 0 || !exportFileName.trim()}
              >
                导出
              </Button>
            )}
          </Space>
        </Flex>
      </Space>
    </Modal>
  );
}
