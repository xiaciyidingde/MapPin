import { Modal, Form, Select, InputNumber, Space, Button, message, Input } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { ProjectionConfig } from '../../types';
import { useMapStore, useSettingsStore } from '../../store';
import { calculateCentralMeridian } from '../../utils/projectionUtils';

interface ProjectionConfigModalProps {
  open: boolean;
  fileName: string;
  onConfirm: (config: ProjectionConfig, customFileName?: string) => void;
  onCancel: () => void;
  okText?: string; // 添加可选的确认按钮文本
}

export function ProjectionConfigModal({
  open,
  fileName,
  onConfirm,
  onCancel,
  okText = '确定并导入', // 默认值
}: ProjectionConfigModalProps) {
  // 从全局设置读取默认值
  const globalCoordinateSystem = useSettingsStore((state) => state.coordinateSystem);
  const globalProjectionType = useSettingsStore((state) => state.projectionType);
  const globalCentralMeridian = useSettingsStore((state) => state.centralMeridian);
  const userLocation = useMapStore((state) => state.userLocation);

  const [coordinateSystem, setCoordinateSystem] = useState<'CGCS2000' | 'Beijing54' | 'Xian80' | 'WGS84'>(globalCoordinateSystem);
  const [projectionType, setProjectionType] = useState<'gauss-3' | 'gauss-6'>(globalProjectionType);
  const [customFileName, setCustomFileName] = useState(() => fileName.replace(/\.dat$/i, ''));
  
  // 当 fileName prop 变化时，更新 customFileName
  useEffect(() => {
    if (open) {
      const newFileName = fileName.replace(/\.dat$/i, '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomFileName(prev => prev !== newFileName ? newFileName : prev);
    }
  }, [fileName, open]);
  
  // 根据当前位置自动计算中央经线，没有位置则使用全局设置
  const [centralMeridian, setCentralMeridian] = useState(() =>
    userLocation
      ? calculateCentralMeridian(userLocation.lng, globalProjectionType)
      : globalCentralMeridian
  );

  // 当对话框打开且有位置信息时，自动计算中央经线
  useEffect(() => {
    if (open && userLocation) {
      const calculatedMeridian = calculateCentralMeridian(userLocation.lng, projectionType);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCentralMeridian(prev => {
        if (prev !== calculatedMeridian) {
          message.info(`已根据当前位置自动计算中央经线：${calculatedMeridian}°E`, 2);
          return calculatedMeridian;
        }
        return prev;
      });
    }
  }, [open, userLocation, projectionType]);

  // 自动计算中央经线
  const handleAutoCalculate = () => {
    if (!userLocation) {
      // 如果没有位置信息，尝试请求位置权限
      if (navigator.geolocation) {
        message.loading({ content: '正在获取位置信息...', key: 'location' });
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            
            // 更新全局位置状态
            useMapStore.getState().setUserLocation(location);
            
            // 计算中央经线
            const calculatedMeridian = calculateCentralMeridian(location.lng, projectionType);
            setCentralMeridian(calculatedMeridian);
            
            message.success({ 
              content: `已自动计算中央经线：${calculatedMeridian}°E`, 
              key: 'location' 
            });
          },
          (error) => {
            message.destroy('location');
            
            if (error.code === error.PERMISSION_DENIED) {
              message.error('位置权限被拒绝，请在浏览器设置中允许访问位置信息');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message.error('无法获取位置信息，请检查设备定位功能是否开启');
            } else if (error.code === error.TIMEOUT) {
              message.error('获取位置信息超时，请重试');
            } else {
              message.error('无法获取位置信息，请稍后再试');
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        message.error('您的浏览器不支持定位功能');
      }
      return;
    }

    // 如果已有位置信息，直接计算
    const calculatedMeridian = calculateCentralMeridian(userLocation.lng, projectionType);
    setCentralMeridian(calculatedMeridian);
    message.success(`已自动计算中央经线：${calculatedMeridian}°E`);
  };

  const handleConfirm = () => {
    const trimmedFileName = customFileName.trim();
    if (!trimmedFileName) {
      message.error('文件名不能为空');
      return;
    }
    
    // 确保文件名有 .dat 扩展名
    const finalFileName = trimmedFileName.endsWith('.dat') 
      ? trimmedFileName 
      : `${trimmedFileName}.dat`;
    
    onConfirm(
      {
        coordinateSystem,
        projectionType,
        centralMeridian,
      },
      finalFileName !== fileName ? finalFileName : undefined
    );
  };

  return (
    <Modal
      open={open}
      title="配置投影参数"
      onCancel={onCancel}
      onOk={handleConfirm}
      okText={okText}
      cancelText="取消"
      width={500}
      mask={{ closable: true }}
      centered
    >
      <div style={{ marginBottom: 16 }}>
        <Form.Item label="文件名">
          <Input
            value={customFileName}
            onChange={(e) => setCustomFileName(e.target.value)}
            placeholder="请输入文件名"
            suffix=".dat"
          />
        </Form.Item>
      </div>

      <Form layout="vertical">
        <Form.Item label="坐标系统" tooltip="选择测量数据使用的坐标系统">
          <Select
            value={coordinateSystem}
            onChange={setCoordinateSystem}
            options={[
              { label: 'CGCS2000（中国大地坐标系2000）', value: 'CGCS2000' },
              { label: 'Beijing54（北京54坐标系）', value: 'Beijing54' },
              { label: 'Xian80（西安80坐标系）', value: 'Xian80' },
              { label: 'WGS84（世界大地坐标系）', value: 'WGS84' },
            ]}
          />
        </Form.Item>

        <Form.Item label="投影方式" tooltip="选择高斯投影的分带方式">
          <Select
            value={projectionType}
            onChange={setProjectionType}
            options={[
              { label: '高斯投影（3°带）', value: 'gauss-3' },
              { label: '高斯投影（6°带）', value: 'gauss-6' },
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
                border: '1px solid #d9d9d9',
                borderLeft: 0,
                background: '#fafafa',
                color: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              °E
            </div>
            <Button
              icon={<AimOutlined />}
              onClick={handleAutoCalculate}
              style={{ borderLeft: 0 }}
              title={userLocation ? '根据当前位置自动计算' : '点击获取位置并自动计算'}
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
    </Modal>
  );
}
