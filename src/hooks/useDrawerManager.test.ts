import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawerManager } from './useDrawerManager';

describe('useDrawerManager', () => {
  beforeEach(() => {
    // No mocks needed for this hook
  });

  describe('openDrawer', () => {
    it('应该打开指定抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('settings');
      });

      expect(result.current.drawerState.type).toBe('settings');
    });

    it('应该打开抽屉并设置标签页', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('settings', 'global');
      });

      expect(result.current.drawerState.type).toBe('settings');
      expect(result.current.drawerState.tab).toBe('global');
    });

    it('应该打开抽屉并传递数据', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('fileSettings', undefined, { fileId: 'file1' });
      });

      expect(result.current.drawerState.type).toBe('fileSettings');
      expect(result.current.drawerState.data).toEqual({ fileId: 'file1' });
    });
  });

  describe('closeDrawer', () => {
    it('应该关闭当前抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('settings');
      });

      expect(result.current.drawerState.type).toBe('settings');

      act(() => {
        result.current.closeDrawer();
      });

      expect(result.current.drawerState.type).toBeNull();
    });
  });

  describe('closeAllDrawers', () => {
    it('应该关闭所有抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('settings');
      });

      expect(result.current.drawerState.type).toBe('settings');

      act(() => {
        result.current.closeAllDrawers();
      });

      expect(result.current.drawerState.type).toBeNull();
    });
  });

  describe('isDrawerOpen', () => {
    it('应该检查抽屉是否打开', () => {
      const { result } = renderHook(() => useDrawerManager());

      expect(result.current.isDrawerOpen('settings')).toBe(false);

      act(() => {
        result.current.openDrawer('settings');
      });

      expect(result.current.isDrawerOpen('settings')).toBe(true);
      expect(result.current.isDrawerOpen('tools')).toBe(false);
    });
  });

  describe('getDrawerData', () => {
    it('应该获取当前抽屉数据', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('fileSettings', undefined, { fileId: 'file1' });
      });

      expect(result.current.getDrawerData()).toEqual({ fileId: 'file1' });
    });

    it('应该在没有数据时返回 undefined', () => {
      const { result } = renderHook(() => useDrawerManager());

      expect(result.current.getDrawerData()).toBeUndefined();
    });
  });

  describe('getDrawerTab', () => {
    it('应该获取当前抽屉标签页', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openDrawer('settings', 'global');
      });

      expect(result.current.getDrawerTab()).toBe('global');
    });

    it('应该在没有标签页时返回 undefined', () => {
      const { result } = renderHook(() => useDrawerManager());

      expect(result.current.getDrawerTab()).toBeUndefined();
    });
  });

  describe('便捷方法', () => {
    it('openFileManagement 应该打开文件管理抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openFileManagement();
      });

      expect(result.current.drawerState.type).toBe('fileManagement');
    });

    it('openSettings 应该打开设置抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openSettings('global');
      });

      expect(result.current.drawerState.type).toBe('settings');
      expect(result.current.drawerState.tab).toBe('global');
    });

    it('openSettings 应该使用默认标签页', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openSettings();
      });

      expect(result.current.drawerState.type).toBe('settings');
      expect(result.current.drawerState.tab).toBe('global');
    });

    it('openPointSettings 应该打开点设置抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openPointSettings('points');
      });

      expect(result.current.drawerState.type).toBe('tools');
      expect(result.current.drawerState.tab).toBe('points');
    });

    it('openPointSettings 应该使用默认标签页', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openPointSettings();
      });

      expect(result.current.drawerState.type).toBe('tools');
      expect(result.current.drawerState.tab).toBe('points');
    });

    it('openFileSettings 应该打开文件设置抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openFileSettings('file1');
      });

      expect(result.current.drawerState.type).toBe('fileSettings');
      expect(result.current.drawerState.data).toEqual({ fileId: 'file1' });
    });

    it('openAbout 应该打开关于抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openAbout();
      });

      expect(result.current.drawerState.type).toBe('about');
    });

    it('openAddPoint 应该打开工具抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openAddPoint();
      });

      expect(result.current.drawerState.type).toBe('addPoint');
    });

    it('openSettings 应该先关闭所有抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openPointSettings();
      });

      expect(result.current.drawerState.type).toBe('tools');

      act(() => {
        result.current.openSettings();
      });

      expect(result.current.drawerState.type).toBe('settings');
    });

    it('openFileSettings 应该先关闭所有抽屉', () => {
      const { result } = renderHook(() => useDrawerManager());

      act(() => {
        result.current.openPointSettings();
      });

      expect(result.current.drawerState.type).toBe('tools');

      act(() => {
        result.current.openFileSettings('file1');
      });

      expect(result.current.drawerState.type).toBe('fileSettings');
    });
  });

  describe('fileManagementTab', () => {
    it('应该管理文件管理标签页状态', () => {
      const { result } = renderHook(() => useDrawerManager());

      expect(result.current.fileManagementTab).toBe('files');

      act(() => {
        result.current.setFileManagementTab('recycle');
      });

      expect(result.current.fileManagementTab).toBe('recycle');
    });
  });
});
