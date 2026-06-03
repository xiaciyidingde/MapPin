/**
 * 定位面板组件
 * 整合 CORS 管理、RTK 状态、定位模式切换等功能
 */

import { Tabs } from 'antd';
import { CORSManager } from './CORSManager';
import { RTKIndicator } from './RTKIndicator';

export function LocationPanel() {
  const items = [
    {
      key: 'cors',
      label: 'CORS 管理',
      children: <CORSManager />,
    },
    {
      key: 'rtk',
      label: 'RTK 状态',
      children: <RTKIndicator />,
    },
  ];

  return (
    <div style={{ height: '100%' }}>
      <Tabs
        defaultActiveKey="cors"
        items={items}
        style={{ height: '100%' }}
        tabBarStyle={{ paddingLeft: 16 }}
      />
    </div>
  );
}
