import { Icon } from './Icon';
import { Card, Space, Typography } from 'antd';

const { Title, Text } = Typography;

/**
 * 图标展示组件 - 显示所有可用的图标
 * 这个组件可以帮助你查看和测试 icons.svg 中的所有图标
 */
export function IconShowcase() {
  const icons = [
    { name: 'control-point', label: '控制点' },
    { name: 'survey-point', label: '碎部点' },
    { name: 'map-icon', label: '地图' },
    { name: 'settings-icon', label: '设置' },
    { name: 'upload-icon', label: '上传' },
    { name: 'location-icon', label: '定位' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>图标库</Title>
      <Text type="secondary">
        所有图标都存储在 public/icons.svg 文件中
      </Text>

      <div style={{ marginTop: 24 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {/* 默认大小 */}
          <Card title="默认大小 (24px)">
            <Space size="large" wrap>
              {icons.map((icon) => (
                <div key={icon.name} style={{ textAlign: 'center' }}>
                  <Icon name={icon.name} />
                  <div style={{ fontSize: 12, marginTop: 8 }}>{icon.label}</div>
                </div>
              ))}
            </Space>
          </Card>

          {/* 大尺寸 */}
          <Card title="大尺寸 (48px)">
            <Space size="large" wrap>
              {icons.map((icon) => (
                <div key={icon.name} style={{ textAlign: 'center' }}>
                  <Icon name={icon.name} size={48} />
                  <div style={{ fontSize: 12, marginTop: 8 }}>{icon.label}</div>
                </div>
              ))}
            </Space>
          </Card>

          {/* 自定义颜色 */}
          <Card title="自定义颜色">
            <Space size="large" wrap>
              {icons.map((icon) => (
                <div key={icon.name} style={{ textAlign: 'center' }}>
                  <Icon name={icon.name} size={32} color="#1890ff" />
                  <div style={{ fontSize: 12, marginTop: 8 }}>{icon.label}</div>
                </div>
              ))}
            </Space>
          </Card>

          {/* 使用示例代码 */}
          <Card title="使用示例">
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
              {`import { Icon } from './components/Icon';

// 基本使用
<Icon name="control-point" />

// 自定义大小
<Icon name="map-icon" size={32} />

// 自定义颜色
<Icon name="settings-icon" color="#1890ff" />

// 使用 Tailwind CSS
<Icon name="location-icon" className="text-blue-500" />`}
            </pre>
          </Card>
        </Space>
      </div>
    </div>
  );
}
