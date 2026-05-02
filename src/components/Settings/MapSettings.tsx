import { Form, Switch, Select, InputNumber, Space, Input } from 'antd';
import { useSettingsStore } from '../../store';
import { MAP_TILE_SOURCES } from '../../config/mapTileSources';

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
  
  // 地图源设置
  const mapTileSource = useSettingsStore((state) => state.mapTileSource);
  const setMapTileSource = useSettingsStore((state) => state.setMapTileSource);
  const apiKeys = useSettingsStore((state) => state.apiKeys);
  const setApiKey = useSettingsStore((state) => state.setApiKey);

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

          <Form.Item label="投影方式" tooltip="创建或导入文件时的默认投影方式">
            <Select
              value={projectionType}
              onChange={setProjectionType}
              options={[
                { label: '高斯投影（3°带）', value: 'gauss-3' },
                { label: '高斯投影（6°带）', value: 'gauss-6' },
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

        {/* 地图源设置 */}
        <div className="text-sm text-gray-600 mb-4" style={{ marginTop: 32 }}>
          🗺️ 地图源
        </div>
        <Form layout="vertical">
          <Form.Item label="底图类型" tooltip="选择地图底图样式">
            <Select
              value={mapTileSource}
              onChange={setMapTileSource}
              options={Object.values(MAP_TILE_SOURCES).map(source => ({
                label: source.name,
                value: source.id,
              }))}
            />
            <div className="text-xs text-gray-500 mt-2">
              {MAP_TILE_SOURCES[mapTileSource]?.description}
            </div>
          </Form.Item>

          {MAP_TILE_SOURCES[mapTileSource]?.requiresToken && (
            <Form.Item 
              label="天地图 Token" 
              tooltip="申请地址：https://cloudcenter.tianditu.gov.cn/center/development/myApp"
            >
              <Input.Password
                value={apiKeys.tianditu || ''}
                onChange={(e) => setApiKey('tianditu', e.target.value)}
                placeholder="留空使用默认 Token（有流量限制）"
                visibilityToggle
              />
              <div className="text-xs text-gray-500 mt-2">
                💡 默认使用公共 Token，建议申请个人 Token 以获得更稳定的服务
              </div>
            </Form.Item>
          )}
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
