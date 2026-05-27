import { useState, useMemo } from 'react';
import { Checkbox, Button, Flex, Tag, Typography, App, Form, Select, InputNumber, Space, theme } from 'antd';
import { FileTextOutlined, AimOutlined } from '@ant-design/icons';
import { MultiStepModal } from '../common/MultiStepModal';
import { requestUserLocation, calculateMeridianFromLocation } from '../../utils/locationUtils';
import { useMapStore } from '../../store';
import type { ProjectionConfig, CoordinateSystem, ProjectionType } from '../../types';

const { Text } = Typography;

interface ZipFileInfo {
  name: string;
  content: string;
  size: number;
  pointCount?: number;
}

interface ZipBatchImportModalProps {
  open: boolean;
  files: ZipFileInfo[];
  onConfirm: (selectedFiles: string[], config: ProjectionConfig) => void;
  onCancel: () => void;
}

export function ZipBatchImportModal({
  open,
  files,
  onConfirm,
  onCancel,
}: ZipBatchImportModalProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  
  // 文件选择
  const initialSelectedFiles = useMemo(() => files.map(f => f.name), [files]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialSelectedFiles);
  const [currentStep, setCurrentStep] = useState(0);
  
  // 投影配置
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('CGCS2000');
  const [projectionType, setProjectionType] = useState<ProjectionType>('gauss-3');
  const [centralMeridian, setCentralMeridian] = useState<number>(117);
  const [gettingLocation, setGettingLocation] = useState(false);
  const userLocation = useMapStore((state) => state.userLocation);
  const locationPermissionDenied = useMapStore((state) => state.locationPermissionDenied);

  // 步骤定义
  const steps = [
    { title: '选择' },
    { title: '配置' },
    { title: '确认' },
  ];

  // 文件选择操作
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

  // 获取当前位置并计算中央经线
  const handleGetLocation = async () => {
    // 检查是否有定位权限
    if (locationPermissionDenied) {
      message.warning('定位权限被拒绝，请在浏览器设置中允许访问位置信息');
      return;
    }

    // 如果已有位置信息，直接使用
    if (userLocation) {
      const meridian = calculateMeridianFromLocation(userLocation, projectionType);
      setCentralMeridian(meridian);
      message.success(`已自动计算中央经线：${meridian}°E`);
      return;
    }

    // 如果没有位置信息，尝试请求位置权限
    setGettingLocation(true);
    try {
      const location = await requestUserLocation();
      const meridian = calculateMeridianFromLocation(location, projectionType);
      // 更新全局位置状态
      useMapStore.getState().setUserLocation(location);
      useMapStore.getState().setLocationPermissionDenied(false);
      setCentralMeridian(meridian);
      message.success(`已获取位置：${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    } catch (error) {
      useMapStore.getState().setLocationPermissionDenied(true);
      message.error(error instanceof Error ? error.message : '获取位置失败');
    } finally {
      setGettingLocation(false);
    }
  };

  // 步骤导航
  const handleNext = () => {
    if (currentStep === 0 && selectedFiles.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFinish = () => {
    const config: ProjectionConfig = {
      coordinateSystem,
      projectionType,
      centralMeridian,
    };
    onConfirm(selectedFiles, config);
  };

  const handleCancel = () => {
    setCurrentStep(0);
    setSelectedFiles(initialSelectedFiles);
    onCancel();
  };

  // 计算选中文件的总点数
  const totalPoints = useMemo(() => {
    return files
      .filter(f => selectedFiles.includes(f.name))
      .reduce((sum, f) => sum + (f.pointCount || 0), 0);
  }, [files, selectedFiles]);

  return (
    <MultiStepModal
      open={open}
      title="批量导入文件"
      currentStep={currentStep}
      steps={steps}
      onCancel={handleCancel}
      onPrev={handlePrev}
      onNext={handleNext}
      onFinish={handleFinish}
      nextButtonDisabled={currentStep === 0 && selectedFiles.length === 0}
      finishButtonText="开始导入"
      width={700}
    >
      {/* 步骤 1: 选择文件 */}
      {currentStep === 0 && (
        <Flex vertical gap="middle" style={{ width: '100%' }}>
          <Flex gap={8}>
            <Button size="small" onClick={handleSelectAll}>
              全选
            </Button>
            <Button size="small" onClick={handleDeselectAll}>
              取消全选
            </Button>
            <Text type="secondary" style={{ marginLeft: 'auto', lineHeight: '32px' }}>
              已选择 {selectedFiles.length} / {files.length} 个文件
            </Text>
          </Flex>

          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Flex vertical gap={8}>
              {files.map((file) => (
                <div
                  key={file.name}
                  style={{
                    padding: 12,
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedFiles.includes(file.name) ? token.colorPrimaryBg : token.colorBgContainer,
                    borderColor: selectedFiles.includes(file.name) ? token.colorPrimaryBorder : token.colorBorder,
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleToggle(file.name)}
                >
                  <Flex align="center" gap={12}>
                    <Checkbox
                      checked={selectedFiles.includes(file.name)}
                      onChange={() => handleToggle(file.name)}
                    />
                    <FileTextOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
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
      )}

      {/* 步骤 2: 配置投影 */}
      {currentStep === 1 && (
        <Form layout="vertical">
          <Form.Item label="坐标系统" tooltip="选择测量数据使用的坐标系统">
            <Select
              value={coordinateSystem}
              onChange={setCoordinateSystem}
              options={[
                { label: 'CGCS2000（中国大地坐标系2000）', value: 'CGCS2000' },
                { label: 'WGS84（世界大地坐标系）', value: 'WGS84' },
                { label: 'Beijing54（北京54坐标系）', value: 'Beijing54' },
                { label: 'Xian80（西安80坐标系）', value: 'Xian80' },
              ]}
            />
          </Form.Item>

          <Form.Item label="投影方式" tooltip="选择坐标投影方式">
            <Select
              value={projectionType}
              onChange={setProjectionType}
              options={[
                { label: '高斯-克吕格投影 3°带', value: 'gauss-3' },
                { label: '高斯-克吕格投影 6°带', value: 'gauss-6' },
              ]}
            />
          </Form.Item>

          <Form.Item label="中央经线" tooltip="投影的中央经线（度）">
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                value={centralMeridian}
                min={75}
                max={135}
                step={projectionType === 'gauss-3' ? 3 : 6}
                style={{ width: '100%' }}
                onChange={(value) => value != null && setCentralMeridian(value)}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  borderTop: `1px solid ${token.colorBorder}`,
                  borderRight: `1px solid ${token.colorBorder}`,
                  borderBottom: `1px solid ${token.colorBorder}`,
                  background: token.colorBgContainer,
                  color: token.colorTextSecondary,
                }}
              >
                °E
              </div>
              <Button
                icon={<AimOutlined />}
                onClick={handleGetLocation}
                loading={gettingLocation}
                style={{ 
                  borderTop: `1px solid ${token.colorBorder}`,
                  borderRight: `1px solid ${token.colorBorder}`,
                  borderBottom: `1px solid ${token.colorBorder}`
                }}
                title="根据当前位置自动计算"
              />
            </Space.Compact>
            <div className="text-xs text-gray-500 mt-1">
              {userLocation
                ? `当前位置：${userLocation.lat.toFixed(4)}°N, ${userLocation.lng.toFixed(4)}°E`
                : '等待获取位置信息...'}
            </div>
            <div className="text-xs text-orange-500 mt-1">
              💡 提示：自动计算基于当前位置，如果测量数据不在此处，请手动输入正确的中央经线
            </div>
          </Form.Item>
        </Form>
      )}

      {/* 步骤 3: 确认导入 */}
      {currentStep === 2 && (
        <Flex vertical gap="large" style={{ width: '100%' }}>
          {/* 文件信息 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              导入文件
            </Text>
            <div
              style={{
                padding: 12,
                background: token.colorFillAlter,
                borderRadius: 8,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              <Flex vertical gap={4} style={{ width: '100%' }}>
                {files
                  .filter(f => selectedFiles.includes(f.name))
                  .map((file) => (
                    <Flex key={file.name} justify="space-between" align="center">
                      <Text>{file.name}</Text>
                      <Flex gap={8}>
                        <Tag color="default">{(file.size / 1024).toFixed(1)} KB</Tag>
                        {file.pointCount !== undefined && (
                          <Tag color="blue">{file.pointCount} 点</Tag>
                        )}
                      </Flex>
                    </Flex>
                  ))}
              </Flex>
            </div>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              共 {selectedFiles.length} 个文件，约 {totalPoints} 个点位
            </Text>
          </div>

          {/* 投影配置 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              投影配置
            </Text>
            <div style={{ padding: 12, background: token.colorFillAlter, borderRadius: 8 }}>
              <Flex vertical gap={4} style={{ width: '100%' }}>
                <Flex justify="space-between">
                  <Text type="secondary">坐标系统：</Text>
                  <Text strong>{coordinateSystem}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text type="secondary">投影类型：</Text>
                  <Text strong>
                    {projectionType === 'gauss-3' ? '高斯-克吕格 3° 分带' : '高斯-克吕格 6° 分带'}
                  </Text>
                </Flex>
                <Flex justify="space-between">
                  <Text type="secondary">中央经线：</Text>
                  <Text strong>{centralMeridian}°</Text>
                </Flex>
              </Flex>
            </div>
          </div>
        </Flex>
      )}
    </MultiStepModal>
  );
}
