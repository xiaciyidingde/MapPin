import { Modal, Form, Select, InputNumber, Space, Button, message, Input } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useDataStore } from '../../store';
import { useMapStore } from '../../store';
import { coordinateConverter } from '../../services/coordinateConverter';
import { useFileNameValidation } from '../../hooks/useFileNameValidation';
import { calculateCentralMeridian } from '../../utils/projectionUtils';
import { appConfig } from '../../config/appConfig';

interface FileSettingsProps {
  open: boolean;
  fileId: string | null;
  onClose: () => void;
}

export function FileSettings({ open, fileId, onClose }: FileSettingsProps) {
  const files = useDataStore((state) => state.files);
  const points = useDataStore((state) => state.points);
  const updateFile = useDataStore((state) => state.updateFile);
  const updatePoint = useDataStore((state) => state.updatePoint);
  const loadPoints = useDataStore((state) => state.loadPoints);
  const userLocation = useMapStore((state) => state.userLocation);
  
  // 使用文件名验证 Hook
  const { validateFileName } = useFileNameValidation();

  // 获取当前文件
  const currentFile = files.find((f) => f.id === fileId);

  // 使用固定的默认值
  const [fileName, setFileName] = useState(currentFile?.name.replace(/\.dat$/i, '') || '');
  const [coordinateSystem, setCoordinateSystem] = useState(
    currentFile?.projectionConfig?.coordinateSystem || 'CGCS2000'
  );
  const [projectionType, setProjectionType] = useState(
    currentFile?.projectionConfig?.projectionType || 'gauss-3'
  );
  const [centralMeridian, setCentralMeridian] = useState(
    currentFile?.projectionConfig?.centralMeridian || appConfig.coordinate.defaultCentralMeridian
  );

  // 当文件变化时更新状态
  // 这是响应外部状态变化的合理用例
  useEffect(() => {
    if (currentFile) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFileName(currentFile.name.replace(/\.dat$/i, ''));
      if (currentFile.projectionConfig) {
        setCoordinateSystem(currentFile.projectionConfig.coordinateSystem);
        setProjectionType(currentFile.projectionConfig.projectionType);
        setCentralMeridian(currentFile.projectionConfig.centralMeridian);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [currentFile]);

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
              key: 'location',
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

  const handleSave = async () => {
    if (!currentFile) return;

    // 使用 Hook 验证文件名
    const finalFileName = validateFileName(fileName);
    if (!finalFileName) return;

    // 确保文件名有 .dat 扩展名
    const fileNameWithExt = finalFileName.endsWith('.dat') 
      ? finalFileName 
      : `${finalFileName}.dat`;

    try {
      // 检查坐标系统或投影配置是否变化
      const configChanged = 
        currentFile.projectionConfig?.coordinateSystem !== coordinateSystem ||
        currentFile.projectionConfig?.projectionType !== projectionType ||
        currentFile.projectionConfig?.centralMeridian !== centralMeridian;

      // 更新文件名和投影配置
      await updateFile(currentFile.id, {
        name: fileNameWithExt,
        projectionConfig: {
          coordinateSystem,
          projectionType,
          centralMeridian,
        },
      });

      // 如果坐标配置变化，需要重新转换所有点的坐标
      if (configChanged) {
        message.loading({ content: '正在重新转换坐标...', key: 'converting', duration: 0 });
        
        // 获取该文件的所有点
        const filePoints = points.get(currentFile.id) || [];
        
        // 重新转换每个点的坐标
        for (const point of filePoints) {
          const { lat, lng } = coordinateConverter.projectToWGS84(
            point.x,
            point.y,
            coordinateSystem,
            projectionType,
            centralMeridian
          );
          
          // 更新点的经纬度坐标
          await updatePoint(currentFile.id, point.id, { lat, lng });
        }
        
        // 重新加载点数据以刷新地图
        await loadPoints(currentFile.id);
        
        message.success({ content: '坐标转换完成', key: 'converting' });
      }

      message.success('文件设置已保存');
      onClose();
    } catch (error) {
      console.error('保存文件设置失败:', error);
      message.error('保存失败，请重试');
    }
  };

  if (!currentFile) return null;

  return (
    <Modal
      open={open}
      title="文件设置"
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      width={500}
      centered
      mask={{ closable: false }}
    >
      <div style={{ marginBottom: 16 }}>
        <Form.Item label="文件名">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
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

        <Form.Item label="投影方式" tooltip="选择坐标投影方式，用于将地理坐标转换为平面坐标">
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
            💡 提示：修改投影配置后，地图上的点位置将自动更新
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
