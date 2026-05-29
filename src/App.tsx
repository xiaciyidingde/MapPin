import { useState, lazy, Suspense, useRef } from 'react';
import { Layout, Button, FloatButton, Spin, Tabs, ConfigProvider, App as AntApp, theme } from 'antd';
import { FileTextOutlined, AimOutlined, SettingOutlined, ColumnWidthOutlined, ToolOutlined, AppstoreOutlined, GlobalOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { UploadZone } from './components/FileUpload/UploadZone';
import { FileList } from './components/FileUpload/FileList';
import { Statistics } from './components/DataPanel/Statistics';
import { DataSettings } from './components/Settings/DataSettings';
import { MapView } from './components/Map/MapView';
import { PointSearch } from './components/Search/PointSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NetworkStatus } from './components/NetworkStatus';
import { BottomDrawer } from './components/common/BottomDrawer';
import { useMapStore, useSettingsStore } from './store';
import { useDrawerManager, type DrawerType } from './hooks/useDrawerManager';
import { useLocationTracking } from './hooks/useLocationTracking';
import { useTitleAnimation } from './hooks/useTitleAnimation';
import { useDataLoader } from './hooks/useDataLoader';
import { lightTheme, darkTheme } from './themes';
import './App.css';

// 懒加载非首屏组件
const SettingsDrawer = lazy(() => import('./components/Settings/SettingsDrawer').then(module => ({ default: module.SettingsDrawer })));
const ToolsDrawer = lazy(() => import('./components/Tools/ToolsDrawer').then(module => ({ default: module.ToolsDrawer })));
const AddPointDrawer = lazy(() => import('./components/AddPoint/AddPointDrawer').then(module => ({ default: module.AddPointDrawer })));
const FileSettings = lazy(() => import('./components/Settings/FileSettings').then(module => ({ default: module.FileSettings })));
const AboutDrawer = lazy(() => import('./components/About/AboutDrawer').then(module => ({ default: module.AboutDrawer })));

const { Header, Content } = Layout;

function App() {
  // 测量工具状态
  const [measureActive, setMeasureActive] = useState(false);

  // 使用自定义 Hooks
  const {
    isDrawerOpen,
    closeDrawer,
    openFileManagement,
    openSettings,
    openPointSettings,
    openFileSettings,
    openAbout,
    openAddPoint,
    getDrawerTab,
    getDrawerData,
    fileManagementTab,
    setFileManagementTab,
  } = useDrawerManager();

  const { showTitle, startAnimation } = useTitleAnimation();
  const { currentFileId } = useDataLoader();
  
  // 地图设置
  const autoLocate = useSettingsStore((state) => state.autoLocate);
  const baseMapMode = useMapStore((state) => state.baseMapMode);
  const setBaseMapMode = useMapStore((state) => state.setBaseMapMode);
  const themeMode = useMapStore((state) => state.theme);
  
  // 位置追踪
  const { handleLocate } = useLocationTracking(autoLocate);

  // 打开添加点位 Modal
  const handleAddPoint = () => {
    if (!currentFileId) {
      return;
    }
    openAddPoint();
  };

  return (
    <ErrorBoundary>
      <ConfigProvider theme={themeMode === 'dark' ? darkTheme : lightTheme}>
        <AntApp>
          <AppContent 
            themeMode={themeMode}
            measureActive={measureActive}
            setMeasureActive={setMeasureActive}
            isDrawerOpen={isDrawerOpen}
            closeDrawer={closeDrawer}
            openFileManagement={openFileManagement}
            openSettings={openSettings}
            openPointSettings={openPointSettings}
            openFileSettings={openFileSettings}
            openAbout={openAbout}
            openAddPoint={openAddPoint}
            getDrawerTab={getDrawerTab}
            getDrawerData={getDrawerData}
            fileManagementTab={fileManagementTab}
            setFileManagementTab={setFileManagementTab}
            showTitle={showTitle}
            startAnimation={startAnimation}
            currentFileId={currentFileId}
            autoLocate={autoLocate}
            baseMapMode={baseMapMode}
            setBaseMapMode={setBaseMapMode}
            handleLocate={handleLocate}
            handleAddPoint={handleAddPoint}
          />
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

function AppContent({ 
  themeMode, 
  measureActive, 
  setMeasureActive,
  isDrawerOpen,
  closeDrawer,
  openFileManagement,
  openSettings,
  openPointSettings,
  openFileSettings,
  openAbout,
  getDrawerTab,
  getDrawerData,
  fileManagementTab,
  setFileManagementTab,
  showTitle,
  startAnimation,
  currentFileId: _currentFileId,
  baseMapMode,
  setBaseMapMode,
  handleLocate,
  handleAddPoint,
}: {
  themeMode: string;
  measureActive: boolean;
  setMeasureActive: (active: boolean) => void;
  isDrawerOpen: (type: DrawerType) => boolean;
  closeDrawer: () => void;
  openFileManagement: () => void;
  openSettings: (tab: string) => void;
  openPointSettings: (tab: string) => void;
  openFileSettings: (fileId: string) => void;
  openAbout: () => void;
  openAddPoint: () => void;
  getDrawerTab: () => string | undefined;
  getDrawerData: () => { fileId?: string } | undefined;
  fileManagementTab: string;
  setFileManagementTab: (tab: string) => void;
  showTitle: boolean;
  startAnimation: boolean;
  currentFileId: string | null;
  autoLocate: boolean;
  baseMapMode: 'map' | 'grid';
  setBaseMapMode: (mode: 'map' | 'grid') => void;
  handleLocate: () => void;
  handleAddPoint: () => void;
}) {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const settingsButtonRef = useRef<HTMLDivElement>(null);

  // 打开工具抽屉时的提示
  const handleToolsClick = () => {
    if (!_currentFileId) {
      message.warning('请先打开文件');
      return;
    }
    handleAddPoint();
  };

  return (
    <div data-theme={themeMode}>
      <NetworkStatus />
      <Layout className="min-h-screen">
        {/* 移动端顶部导航栏 */}
        <Header style={{ 
          background: token.colorBgContainer,
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
                  color: token.colorText,
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
        <PointSearch disabled={
          isDrawerOpen('fileManagement') || 
          isDrawerOpen('settings') || 
          isDrawerOpen('tools') || 
          isDrawerOpen('fileSettings') || 
          isDrawerOpen('about')
        } />
        
        {/* 右侧按钮 */}
        <div 
          ref={settingsButtonRef}
          className="settings-button-wrapper"
          onClick={() => {
            const wrapper = settingsButtonRef.current;
            const isOpen = isDrawerOpen('settings');
            
            if (wrapper) {
              if (isOpen) {
                wrapper.classList.add('rotating-reverse');
                setTimeout(() => wrapper.classList.remove('rotating-reverse'), 500);
                closeDrawer();
              } else {
                wrapper.classList.add('rotating');
                setTimeout(() => wrapper.classList.remove('rotating'), 500);
                openSettings('global');
              }
            }
          }}
        >
          <Button
            type="text"
            icon={<SettingOutlined style={{ fontSize: '24px', color: token.colorText }} />}
            className="hover:bg-gray-100"
          />
        </div>
      </Header>

      {/* 地图主体 - 全屏显示 */}
      <Content className="relative" style={{ marginTop: 64, height: 'calc(100dvh - 64px)' }}>
        <MapView measureActive={measureActive} />
      </Content>

      {/* 悬浮按钮组 */}
      <FloatButton.Group shape="circle" style={{ right: 16, bottom: 24 }}>
        <FloatButton
          icon={<QuestionCircleOutlined />}
          onClick={openAbout}
        />
        <FloatButton
          icon={<ToolOutlined />}
          onClick={handleToolsClick}
        />
        <FloatButton
          icon={baseMapMode === 'map' ? <AppstoreOutlined /> : <GlobalOutlined />}
          onClick={() => setBaseMapMode(baseMapMode === 'map' ? 'grid' : 'map')}
        />
        <FloatButton
          icon={<SettingOutlined />}
          onClick={() => openPointSettings('points')}
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
          onClick={openFileManagement}
        />
      </FloatButton.Group>

      {/* 文件管理抽屉 */}
      <BottomDrawer
        title="文件管理"
        open={isDrawerOpen('fileManagement')}
        onClose={closeDrawer}
        destroyOnClose={true}
        styles={{
          body: { 
            padding: 0, 
            height: 'calc(100vh - 64px - 55px)', 
            maxHeight: 'calc(100dvh - 64px - 55px)', 
            display: 'flex', 
            flexDirection: 'column' 
          }
        }}
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
                  <UploadZone onFileUploaded={closeDrawer} />
                  <Statistics />
                  <div className="mt-4">
                    <FileList 
                      onOpenSettings={(fileId) => {
                        openFileSettings(fileId);
                      }}
                      onFileSelect={closeDrawer}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'data',
              label: '数据管理',
              children: <DataSettings onCloseDrawer={closeDrawer} />,
            },
          ]}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          tabBarStyle={{ 
            paddingLeft: 16, 
            paddingRight: 16, 
            margin: 0,
            flexShrink: 0
          }}
          styles={{
            content: { flex: 1, overflow: 'auto', padding: '16px' }
          }}
        />
      </BottomDrawer>

      {/* 设置抽屉 - 从底部滑上来，不覆盖标题栏 */}
      <BottomDrawer
        title="设置"
        open={isDrawerOpen('settings')}
        onClose={closeDrawer}
        destroyOnClose={true}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <SettingsDrawer
            open={isDrawerOpen('settings')}
            onClose={closeDrawer}
            defaultTab={getDrawerTab() || 'global'}
          />
        </Suspense>
      </BottomDrawer>

      {/* 点设置抽屉 - 从底部滑上来，高度比设置低 */}
      <BottomDrawer
        title="点设置"
        open={isDrawerOpen('tools')}
        onClose={closeDrawer}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <ToolsDrawer
            open={isDrawerOpen('tools')}
            onClose={closeDrawer}
            defaultTab={getDrawerTab() || 'points'}
          />
        </Suspense>
      </BottomDrawer>

      {/* 文件设置对话框 */}
      <Suspense fallback={null}>
        <FileSettings
          open={isDrawerOpen('fileSettings')}
          fileId={getDrawerData()?.fileId || null}
          onClose={closeDrawer}
        />
      </Suspense>

      {/* 关于抽屉 - 从底部滑上来，不覆盖标题栏 */}
      <BottomDrawer
        title="关于"
        open={isDrawerOpen('about')}
        onClose={closeDrawer}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <AboutDrawer />
        </Suspense>
      </BottomDrawer>

      {/* 工具抽屉 */}
      <BottomDrawer
        title="工具"
        open={isDrawerOpen('addPoint')}
        onClose={closeDrawer}
      >
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Spin size="large" /></div>}>
          <AddPointDrawer
            open={isDrawerOpen('addPoint')}
            onClose={closeDrawer}
            defaultTab={getDrawerTab() || 'add'}
          />
        </Suspense>
      </BottomDrawer>
    </Layout>
    </div>
  );
}

export default App;
