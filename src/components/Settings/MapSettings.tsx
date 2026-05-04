import { Form, Switch, Select, InputNumber, Space } from 'antd';
import { useSettingsStore } from '../../store';

export function MapSettings() {
  // 投影配置
  const coordinateSystem = useSettingsStore((state) => state.coordinateSystem);
  const setCoordinateSystem = useSettingsStore((state) => state.setCoordinateSystem);
  const projectionType = useSettingsStore((state) => state.projectionType);
  const setProjectionType = useSettingsStore((state) => state.setProjectionType);
  const centralMeridian = useSettingsStore((state) => state.centralMeridian);
  const setCentralMeridian = useSettingsStore((state) => state.setCentralMeridian);
  
  // 地图显示设置
  const showUserLocation = useSettingsStore((state) => state.showUserLocation);
  const setShowUserLocation = useSettingsStore((state) => state.setShowUserLocation);
  const autoLocate = useSettingsStore((state) => state.autoLocate);
  const setAutoLocate = useSettingsStore((state) => state.setAutoLocate);
  const showPointLabels = useSettingsStore((state) => state.showPointLabels);
  const setShowPointLabels = useSettingsStore((state) => state.setShowPointLabels);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* 投影配置设置 */}
        <div className="text-sm text-gray-600 mb-4">
          🌐 默认投影配置
        </div>
        <Form layout="vertical">
          <Form.Item label="坐标系统" tooltip="创建或导入文件时的默认坐标系统">
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

          <Form.Item label="中央经线" tooltip="创建或导入文件时的默认中央经线（度）">
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
            </Space.Compact>
          </Form.Item>
        </Form>

        {/* 地图显示设置 */}
        <div className="text-sm text-gray-600 mb-4" style={{ marginTop: 32 }}>
          🗺️ 地图显示
        </div>
        <Form layout="vertical">
          <Form.Item label="显示用户位置" tooltip="在地图上显示当前位置标记">
            <Switch checked={showUserLocation} onChange={setShowUserLocation} />
          </Form.Item>

          <Form.Item label="自动定位" tooltip="打开应用时自动定位到当前位置">
            <Switch checked={autoLocate} onChange={setAutoLocate} />
          </Form.Item>

          <Form.Item label="显示点号标签" tooltip="在地图上直接显示点号">
            <Switch checked={showPointLabels} onChange={setShowPointLabels} />
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
