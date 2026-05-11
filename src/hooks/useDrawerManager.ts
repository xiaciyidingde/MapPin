import { useState, useCallback } from 'react';

/**
 * 抽屉类型定义
 */
export type DrawerType = 
  | 'fileManagement'
  | 'settings'
  | 'tools'
  | 'fileSettings'
  | 'about'
  | 'addPoint';

/**
 * 抽屉数据类型
 */
interface DrawerData {
  fileId?: string;
  [key: string]: unknown;
}

/**
 * 抽屉状态接口
 */
interface DrawerState {
  type: DrawerType | null;
  tab?: string;
  data?: DrawerData;
}

/**
 * 抽屉管理 Hook
 * 统一管理所有抽屉的打开/关闭状态
 */
export function useDrawerManager() {
  const [drawerState, setDrawerState] = useState<DrawerState>({ type: null });
  const [fileManagementTab, setFileManagementTab] = useState('files');

  /**
   * 打开指定抽屉
   */
  const openDrawer = useCallback((type: DrawerType, tab?: string, data?: DrawerData) => {
    setDrawerState({ type, tab, data });
  }, []);

  /**
   * 关闭当前抽屉
   */
  const closeDrawer = useCallback(() => {
    setDrawerState({ type: null });
  }, []);

  /**
   * 关闭所有抽屉
   */
  const closeAllDrawers = useCallback(() => {
    setDrawerState({ type: null });
  }, []);

  /**
   * 检查指定抽屉是否打开
   */
  const isDrawerOpen = useCallback((type: DrawerType) => {
    return drawerState.type === type;
  }, [drawerState.type]);

  /**
   * 获取当前抽屉数据
   */
  const getDrawerData = useCallback(() => {
    return drawerState.data;
  }, [drawerState.data]);

  /**
   * 获取当前抽屉标签页
   */
  const getDrawerTab = useCallback(() => {
    return drawerState.tab;
  }, [drawerState.tab]);

  /**
   * 打开文件管理抽屉
   */
  const openFileManagement = useCallback(() => {
    openDrawer('fileManagement');
  }, [openDrawer]);

  /**
   * 打开设置抽屉
   */
  const openSettings = useCallback((tab: string = 'global') => {
    closeAllDrawers();
    openDrawer('settings', tab);
  }, [openDrawer, closeAllDrawers]);

  /**
   * 打开工具抽屉
   */
  const openTools = useCallback((tab: string = 'points') => {
    openDrawer('tools', tab);
  }, [openDrawer]);

  /**
   * 打开文件设置
   */
  const openFileSettings = useCallback((fileId: string) => {
    closeAllDrawers();
    openDrawer('fileSettings', undefined, { fileId });
  }, [openDrawer, closeAllDrawers]);

  /**
   * 打开关于抽屉
   */
  const openAbout = useCallback(() => {
    openDrawer('about');
  }, [openDrawer]);

  /**
   * 打开添加点位 Modal
   */
  const openAddPoint = useCallback(() => {
    openDrawer('addPoint');
  }, [openDrawer]);

  return {
    // 状态
    drawerState,
    fileManagementTab,
    setFileManagementTab,
    
    // 通用方法
    openDrawer,
    closeDrawer,
    closeAllDrawers,
    isDrawerOpen,
    getDrawerData,
    getDrawerTab,
    
    // 便捷方法
    openFileManagement,
    openSettings,
    openTools,
    openFileSettings,
    openAbout,
    openAddPoint,
  };
}
