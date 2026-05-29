/**
 * 消息提示工具
 * 统一管理消息显示时长
 */
import { message as antMessage } from 'antd';
import { appConfig } from '../config/appConfig';

export const message = {
  success: (content: string, duration?: number) => {
    return antMessage.success(content, duration ?? appConfig.ui.messageDisplayDuration / 1000);
  },
  error: (content: string, duration?: number) => {
    return antMessage.error(content, duration ?? appConfig.ui.messageDisplayDuration / 1000);
  },
  warning: (content: string, duration?: number) => {
    return antMessage.warning(content, duration ?? appConfig.ui.messageDisplayDuration / 1000);
  },
  info: (content: string, duration?: number) => {
    return antMessage.info(content, duration ?? appConfig.ui.messageDisplayDuration / 1000);
  },
  loading: (content: string, duration?: number) => {
    return antMessage.loading(content, duration ?? 0);
  },
};
