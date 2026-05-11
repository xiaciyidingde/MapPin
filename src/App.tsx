import { useEffect, useState, lazy, Suspense } from 'react';
import { Layout, Drawer, Button, FloatButton, Spin, message, Tabs } from 'antd';
import { FileTextOutlined, AimOutlined, SettingOutlined, ColumnWidthOutlined, ToolOutlined, AppstoreOutlined, GlobalOutlined, QuestionCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { UploadZone } from './components/FileUpload/UploadZone';
import { FileList } from './components/FileUpload/FileList';
import { Statistics } from './components/DataPanel/Statistics';
import { DataSettings } from './components/Settings/DataSettings';
import { MapView } from './components/Map/MapView';
import { PointSearch } from './components/Search/PointSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NetworkStatus } from './components/NetworkStatus';
import { AddPointModal } from './components/AddPoint/AddPointModal';
import { useDataStore, useMapStore, useSettingsStore } from './store';
import './App.css';

// 懒加载非首屏组件
const SettingsDrawer = lazy(() => import('./components/Settings/SettingsDrawer').then(module => ({ default: module.SettingsDrawer })));
const ToolsDrawer = lazy(() => import('./components/Tools/ToolsDrawer').then(module => ({ default: module.ToolsDrawer })));
const FileSettings = lazy(() => import('./components/Settings/FileSettings').then(module => ({ default: module.FileSettings })));
const AboutDrawer = lazy(() => import('./components/About/AboutDrawer').then(module => ({ default: module.AboutDrawer })));

const { Header, Content } = Layout;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileManagementTab, setFileManagementTab] = useState('files');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('global');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState('points');
  const [fileSettingsOpen, setFileSettingsOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [measureActive, setMeasureActive] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [addPointOpen, setAddPointOpen] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [startAnimation, setStartAnimation] = useState(false);

  // 检测屏幕宽度并控制标题动画
  useEffect(() => {
    const checkWidth = () => {
      // 如果宽度小于 500px，启动动画
      if (window.innerWidth < 500) {
        // 1秒后开始动画
        const timer = setTimeout(() => {
          setStartAnimation(true);
          // 动画持续 1 秒后隐藏标题
          setTimeout(() => {
            setShowTitle(false);
          }, 1000);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setShowTitle(true);
        setStartAnimation(false);
      }
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);
  const loadFiles = useDataStore((state) => state.loadFiles);
  const loadPoints = useDataStore((state) => state.loadPoints);
  const currentFileId = useMapStore((state) => state.currentFileId);
  const setView = useMapStore((state) => state.setView);
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const userLocation = useMapStore((state) => state.userLocation);
  const baseMapMode = useMapStore((state) => state.baseMapMode);
  const setBaseMapMode = useMapStore((state) => state.setBaseMapMode);
  const locationPermissionDenied = useMapStore((state) => state.locationPermissionDenied);
  const setLocationPermissionDenied = useMapStore((state) => state.setLocationPermissionDenied);
  
  // 地图设置
  const autoLocate = useSettingsStore((state) => state.autoLocate);

  // 打开设置（可指定默认标签页）
  const openSettings = (tab: string = 'global') => {
    setDrawerOpen(false); // 关闭文件管理抽屉
    setToolsOpen(false); // 关闭工具抽屉
    setAboutOpen(false); // 关闭关于抽屉
    setAddPointOpen(false); // 关闭添加点悬浮窗
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  // 打开工具（可指定默认标签页）
  const openTools = (tab: string = 'points') => {
    setToolsTab(tab);
    setToolsOpen(true);
  };

  // 打开添加点位 Modal
  const handleAddPoint = () => {
    if (!currentFileId) {
      message.warning('请先打开文件');
      return;
    }
    setAddPointOpen(true);
  };

  // 定位到当前位置
  const handleLocate = () => {
    if (userLocation) {
      // 强制触发更新：先设置一个临时的不同值，然后再设置目标值
      setView({ lat: userLocation.lat + 0.0001, lng: userLocation.lng }, 18);
      setTimeout(() => {
        setView(userLocation, 18);
      }, 10);
    } else if (navigator.geolocation) {
      // 高精度定位配置
      const highAccuracyOptions: PositionOptions = {
        enableHighAccuracy: true,  // 启用高精度模式（GPS）
        timeout: 10000,            // 10秒超时
        maximumAge: 0,             // 不使用缓存
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const accuracy = position.coords.accuracy;
          setUserLocation(location, accuracy);
          setView(location, 18);
          setLocationPermissionDenied(false);
        },
        (error) => {
          console.error('无法获取位置:', error);
          
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionDenied(true);
            message.error({
              content: '定位权限被拒绝，请在浏览器设置中允许访问位置信息',
              duration: 5,
            });
          } else if (error.code === error.TIMEOUT) {
            message.warning('定位超时，请确保 GPS 已开启并在户外或窗边');
          } else {
            message.error('无法获取位置信息');
          }
        },
        highAccuracyOptions
      );
    }
  };

  // 请求用户位置并定时更新
  useEffect(() => {
    let watchId: number | null = null;

    if (navigator.geolocation) {
      // 高精度定位配置
      const highAccuracyOptions: PositionOptions = {
        enableHighAccuracy: true,  // 启用高精度模式（GPS）
        timeout: 10000,            // 10秒超时
        maximumAge: 0,             // 不使用缓存，每次都获取新位置
      };

      // 首次获取位置
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const accuracy = position.coords.accuracy;
          setUserLocation(location, accuracy);
          setLocationPermissionDenied(false);
          
          // 只有在启用自动定位时才移动地图视图
          if (autoLocate) {
            setView(location, 16);
          }
        },
        (error) => {
          console.warn('无法获取当前位置:', error.message);
          
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionDenied(true);
            // 权限被拒绝时不显示消息，避免打扰用户
            // 用户点击定位按钮时会显示提示
          } else if (error.code === error.TIMEOUT) {
            // 超时不算严重错误，可能是 GPS 信号问题
            console.warn('定位超时，可能是 GPS 信号弱');
          }
        },
        highAccuracyOptions
      );

      // 只有在权限未被拒绝时才持续监听位置更新
      if (!locationPermissionDenied) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            const accuracy = position.coords.accuracy;
            setUserLocation(location, accuracy);
            setLocationPermissionDenied(false);
          },
          (error) => {
            console.warn('位置更新失败:', error.message);
            
            if (error.code === error.PERMISSION_DENIED) {
              setLocationPermissionDenied(true);
              // 停止监听
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
              }
            }
          },
          {
            enableHighAccuracy: true,  // 启用高精度模式（GPS）
            timeout: 15000,            // 15秒超时（持续监听可以设置更长）
            maximumAge: 5000,          // 5秒缓存（减少GPS功耗）
          }
        );
      }
    }

    // 清理函数
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setView, setUserLocation, autoLocate, setLocationPermissionDenied]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (currentFileId) {
      loadPoints(currentFileId);
    }
  }, [currentFileId, loadPoints]);

  return (
    <ErrorBoundary>
      <NetworkStatus />
      <Layout className="min-h-screen">
      {/* 移动端顶部导航栏 */}
      <Header style={{ 
        background: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        height: '64px',
        lineHeight: '64px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          {/* 应用图标 */}
          <img 
            src="/favicon.png" 
            alt="MapPin Logo" 
            style={{ 
              width: '40px',
              height: '40px',
              maxWidth: '40px',
              maxHeight: '40px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
          {/* 分隔线和标题容器 */}
          {showTitle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', position: 'relative' }}>
              {/* 分隔线 */}
              <div 
                style={{ 
                  width: '2px',
                  height: '24px',
                  backgroundColor: '#d9d9d9',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 2
                }}
              />
              {/* 标题 */}
              <h1 
                className="text-xl font-bold m-0" 
                style={{ 
                  color: '#262626',
                  whiteSpace: 'nowrap',
                  transform: startAnimation ? 'translateX(-120px)' : 'translateX(0)',
                  transition: 'transform 1s linear',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                MapPin
              </h1>
            </div>
          )}
        </div>
        
        {/* 中间搜索框 */}
        <PointSearch disabled={drawerOpen || settingsOpen || toolsOpen || fileSettingsOpen || aboutOpen} />
        
        {/* 右侧按钮 */}
        <Button
          type="text"
          icon={<SettingOutlined style={{ fontSize: '24px', color: '#595959' }} />}
          onClick={() => openSettings('global')}
          className="hover:bg-gray-100"
        />
      </Header>

      {/* 地图主体 - 全屏显示 */}
      <Content className="relative" style={{ marginTop: 64, height: 'calc(100dvh - 64px)' }}>
        <MapView measureActive={measureActive} />
      </Content>

      {/* 悬浮按钮组 */}
      <FloatButton.Group shape="circle" style={{ right: 16, bottom: 24 }}>
        <FloatButton
          icon={<QuestionCircleOutlined />}
          onClick={() => setAboutOpen(true)}
        />
        <FloatButton
          icon={<PlusOutlined />}
          onClick={handleAddPoint}
        />
        <FloatButton
          icon={baseMapMode === 'map' ? <AppstoreOutlined /> : <GlobalOutlined />}
          onClick={() => setBaseMapMode(baseMapMode === 'map' ? 'grid' : 'map')}
        />
        <FloatButton
          icon={<ToolOutlined />}
          onClick={() => openTools('points')}
        />
        <FloatButton
          icon={<ColumnWidthOutlined />}
          onClick={() => setMeasureActive(!measureActive)}
          type={measureActive ? "primary" : "default"}
          style={measureActive ? { backgroundColor: '#ff4d4f' } : undefined}
        />
        <FloatButton
          icon={<AimOutlined />}
          onClick={handleLocate}
          type="primary"
        />
        <FloatButton
          icon={<FileTextOutlined />}
          onClick={() => setDrawerOpen(true)}
        />
      </FloatButton.Group>

      {/* 文件管理抽屉 */}
      <Drawer
        title="文件管理"
        placement="bottom"
        styles={{ 
          body: { padding: 0, height: 'calc(100vh - 64px - 55px)', maxHeight: 'calc(100dvh - 64px - 55px)', display: 'flex', flexDirection: 'column' },
          wrapper: { 
            top: 64,
            height: 'calc(100vh - 64px)',
            maxHeight: 'calc(100dvh - 64px)'
          }
        }}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Tabs
          activeKey={fileManagementTab}
          onChange={setFileManagementTab}
          items={[
            {
              key: 'files',
              label: '文件列表',
              children: (
                <div className="space-y-4">
                  <UploadZone onFileUploaded={() => setDrawerOpen(false)} />
                  <Statistics />
                  <div className="mt-4">
                    <FileList 
                      onOpenSettings={(fileId) => {
                        setDrawerOpen(false);
                        setSelectedFileId(fileId);
                        setFileSettingsOpen(true);
                      }}
                      onFileSelect={() => {
                        // 文件被选中后关闭文件管理抽屉
                        setDrawerOpen(false);
                      }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'data',
              label: '数据管理',
              children: <DataSettings onCloseDrawer={() => setDrawerOpen(false)} />,
            },
          ]}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          tabBarStyle={{ 
            paddingLeft: 16, 
            paddingRight: 16, 
            margin: 0,
            background: '#fff',
            flexShrink: 0
          }}
          styles={{
            content: { flex: 1, overflow: 'auto', padding: '16px' }
          }}
        />
      </Drawer>



      {/* 设置抽屉 - 从底部滑上来，不覆盖标题栏 */}
      <Drawer
        title="设置"
        placement="bottom"
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        styles={{ 
          body: { padding: 0 },
          wrapper: { 
            top: 64, 
            height: 'calc(100dvh - 64px)',
            maxHeight: 'calc(100dvh - 64px)'
          }
        }}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <SettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            defaultTab={settingsTab}
          />
        </Suspense>
      </Drawer>

      {/* 工具抽屉 - 从底部滑上来，高度比设置低 */}
      <Drawer
        title="工具"
        placement="bottom"
        onClose={() => setToolsOpen(false)}
        open={toolsOpen}
        styles={{ 
          body: { padding: 0 },
          wrapper: { 
            top: 64,
            height: 'calc(100vh - 64px)',
            maxHeight: 'calc(100dvh - 64px)'
          }
        }}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <ToolsDrawer
            open={toolsOpen}
            onClose={() => setToolsOpen(false)}
            defaultTab={toolsTab}
          />
        </Suspense>
      </Drawer>

      {/* 文件设置对话框 */}
      <Suspense fallback={null}>
        <FileSettings
          open={fileSettingsOpen}
          fileId={selectedFileId}
          onClose={() => {
            setFileSettingsOpen(false);
            setSelectedFileId(null);
          }}
        />
      </Suspense>

      {/* 关于抽屉 - 从底部滑上来，不覆盖标题栏 */}
      <Drawer
        title="关于"
        placement="bottom"
        onClose={() => setAboutOpen(false)}
        open={aboutOpen}
        styles={{ 
          body: { padding: 0 },
          wrapper: { 
            top: 64, 
            height: 'calc(100dvh - 64px)',
            maxHeight: 'calc(100dvh - 64px)'
          }
        }}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <AboutDrawer />
        </Suspense>
      </Drawer>

      {/* 添加点位 Modal */}
      <AddPointModal
        open={addPointOpen}
        onClose={() => setAddPointOpen(false)}
      />
    </Layout>
    </ErrorBoundary>
  );
}

export default App;
