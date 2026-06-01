/**
 * 消息提示工具
 * 统一管理消息显示时长
 */
import { message as antMessage } from 'antd';
import { appConfig } from '../config/appConfig';

type MessageApi = Pick<typeof antMessage, 'success' | 'error' | 'warning' | 'info' | 'loading' | 'destroy'>;
type MessageContent = Parameters<MessageApi['success']>[0];
type MessageDuration = Parameters<MessageApi['success']>[1];

let boundMessageApi: MessageApi | null = null;

export function bindMessageApi(api: MessageApi | null) {
  boundMessageApi = api;
}

function getMessageApi(): MessageApi {
  return boundMessageApi ?? antMessage;
}

export const message = {
  success: (content: MessageContent, duration?: MessageDuration) => {
    const finalDuration = duration ?? getDefaultDuration(content);
    return finalDuration === undefined
      ? getMessageApi().success(content)
      : getMessageApi().success(content, finalDuration);
  },
  error: (content: MessageContent, duration?: MessageDuration) => {
    const finalDuration = duration ?? getDefaultDuration(content);
    return finalDuration === undefined
      ? getMessageApi().error(content)
      : getMessageApi().error(content, finalDuration);
  },
  warning: (content: MessageContent, duration?: MessageDuration) => {
    const finalDuration = duration ?? getDefaultDuration(content);
    return finalDuration === undefined
      ? getMessageApi().warning(content)
      : getMessageApi().warning(content, finalDuration);
  },
  info: (content: MessageContent, duration?: MessageDuration) => {
    const finalDuration = duration ?? getDefaultDuration(content);
    return finalDuration === undefined
      ? getMessageApi().info(content)
      : getMessageApi().info(content, finalDuration);
  },
  loading: (content: Parameters<MessageApi['loading']>[0], duration?: Parameters<MessageApi['loading']>[1]) => {
    const finalDuration = duration ?? getDefaultLoadingDuration(content);
    return finalDuration === undefined
      ? getMessageApi().loading(content)
      : getMessageApi().loading(content, finalDuration);
  },
  destroy: (key?: Parameters<MessageApi['destroy']>[0]) => {
    return getMessageApi().destroy(key);
  },
};

function getDefaultDuration(content: MessageContent): MessageDuration | undefined {
  return typeof content === 'string' ? appConfig.ui.messageDisplayDuration / 1000 : undefined;
}

function getDefaultLoadingDuration(content: Parameters<MessageApi['loading']>[0]) {
  return typeof content === 'string' ? 0 : undefined;
}
