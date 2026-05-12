import { Tabs, theme } from 'antd';
import { GlobalSettings } from './GlobalSettings';
import { MapSettings } from './MapSettings';
import { UISettings } from './UISettings';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function SettingsDrawer({ defaultTab = 'global' }: SettingsDrawerProps) {
  const { token } = theme.useToken();

  const items = [
    {
      key: 'global',
      label: '全局设置',
      children: <GlobalSettings />,
    },
    {
      key: 'map',
      label: '地图设置',
      children: <MapSettings />,
    },
    {
      key: 'ui',
      label: '界面设置',
      children: <UISettings />,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        defaultActiveKey={defaultTab}
        items={items}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
        tabBarStyle={{ 
          paddingLeft: 16, 
          paddingRight: 16, 
          background: token.colorBgContainer, 
          flexShrink: 0
        }}
        styles={{
          content: { flex: 1, overflow: 'auto' }
        }}
      />
    </div>
  );
}
