import { Tabs } from 'antd';
import { Capacitor } from '@capacitor/core';
import { GlobalSettings } from './GlobalSettings';
import { MapSettings } from './MapSettings';
import { UISettings } from './UISettings';
import { LocationPanel } from '../Location';
import { OfflineDebugCollectorComponent } from '../Debug/OfflineDebugCollector';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function SettingsDrawer({ defaultTab = 'global' }: SettingsDrawerProps) {

  // 基础设置项
  const baseItems = [
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

  // 只在原生平台显示定位设置和离线调试
  const items = Capacitor.isNativePlatform()
    ? [
        ...baseItems,
        {
          key: 'location',
          label: '定位设置',
          children: <LocationPanel />,
        },
        {
          key: 'debug',
          label: '离线调试',
          children: <OfflineDebugCollectorComponent />,
        },
      ]
    : baseItems;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        defaultActiveKey={defaultTab}
        items={items}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
        tabBarStyle={{ 
          paddingLeft: 8, 
          paddingRight: 8, 
          flexShrink: 0,
          marginBottom: 0
        }}
        styles={{
          content: { flex: 1, overflow: 'auto' }
        }}
      />
    </div>
  );
}
