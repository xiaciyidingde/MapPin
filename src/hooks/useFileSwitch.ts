import { useCallback } from 'react';
import { App } from 'antd';
import { useMapStore, useDataStore } from '../store';

interface FileSwitchOptions {
  confirm?: boolean;
  confirmTitle?: string;
  confirmContent?: string;
  okText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

/**
 * 文件切换 Hook
 * 统一处理文件切换逻辑，包括确认对话框和地图自动缩放
 */
export function useFileSwitch() {
  const currentFileId = useMapStore(state => state.currentFileId);
  const setCurrentFileId = useMapStore(state => state.setCurrentFileId);
  const triggerFitToView = useMapStore(state => state.triggerFitToView);
  const files = useDataStore(state => state.files);
  const { modal } = App.useApp();
  
  const switchToFile = useCallback((
    newFileId: string,
    options?: FileSwitchOptions
  ) => {
    const doSwitch = () => {
      setCurrentFileId(newFileId);
      setTimeout(() => triggerFitToView(), 100);
      options?.onConfirm?.();
    };
    
    if (options?.confirm && currentFileId) {
      // 获取当前文件名和新文件名
      const currentFile = files.find(f => f.id === currentFileId);
      const newFile = files.find(f => f.id === newFileId);
      const currentFileName = currentFile?.name || '未知文件';
      const newFileName = newFile?.name || '新文件';
      
      modal.confirm({
        title: options.confirmTitle || '已有打开的文件',
        content: options.confirmContent || `当前已打开文件「${currentFileName}」，是否切换到「${newFileName}」？`,
        okText: options.okText || '切换',
        cancelText: options.cancelText || '取消',
        centered: true,
        onOk: doSwitch,
      });
    } else {
      doSwitch();
    }
  }, [currentFileId, setCurrentFileId, triggerFitToView, files, modal]);
  
  return { switchToFile };
}
