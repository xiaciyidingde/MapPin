import { Card, Flex, theme, Select } from 'antd';
import { BulbOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { ThemeToggle } from '../common/ThemeToggle';
import { useMapStore } from '../../store/useMapStore';

export function UISettings() {
  const { token } = theme.useToken();
  const themeAnimation = useMapStore((state) => state.themeAnimation);
  const setThemeAnimation = useMapStore((state) => state.setThemeAnimation);
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <Flex vertical gap={16} style={{ width: '100%', maxWidth: 600 }}>
        {/* 主题设置卡片 */}
        <Card size="small">
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="center">
              <Flex vertical gap={8}>
                <Flex align="center" gap={8}>
                  <BulbOutlined style={{ fontSize: 18, color: '#faad14' }} />
                  <span className="font-semibold">主题模式</span>
                </Flex>
                <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
                  切换应用的明暗主题
                </div>
              </Flex>
              <ThemeToggle />
            </Flex>
            
            {/* 动画选择 */}
            <div>
              <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                <PlayCircleOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                <span className="font-semibold">切换动画</span>
              </Flex>
              <Select
                value={themeAnimation}
                onChange={setThemeAnimation}
                style={{ width: '100%' }}
                options={[
                  {
                    value: 'simple',
                    label: '简单扩散'
                  },
                  {
                    value: 'triple',
                    label: '三段动画'
                  }
                ]}
              />
            </div>
          </Flex>
        </Card>
      </Flex>
    </div>
  );
}
