import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    colorBgBase: '#141414',
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorBgLayout: '#000000',
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',
    colorTextBase: '#ffffff',
    colorText: '#e8e8e8',
    colorTextSecondary: '#a6a6a6',
    colorTextTertiary: '#8c8c8c',
    colorTextQuaternary: '#595959',
    borderRadius: 8,
  },
  components: {
    Layout: {
      headerBg: '#1f1f1f',
      bodyBg: '#141414',
      siderBg: '#1f1f1f',
    },
    Card: {
      colorBgContainer: '#262626',
      colorBorderSecondary: '#303030',
    },
    Drawer: {
      colorBgElevated: '#1f1f1f',
      colorBgContainer: '#1f1f1f',
      colorBgMask: 'rgba(0, 0, 0, 0.65)',
    },
    Tabs: {
      colorBgContainer: '#1f1f1f',
      cardBg: '#1f1f1f',
      itemColor: '#a6a6a6',
      itemSelectedColor: '#e8e8e8',
      itemHoverColor: '#e8e8e8',
    },
    Input: {
      colorBgContainer: '#141414',
      addonBg: '#262626',
      colorTextPlaceholder: '#595959',
      colorBorder: '#434343',
      activeBorderColor: '#1890ff',
      hoverBorderColor: '#177ddc',
    },
    InputNumber: {
      colorBgContainer: '#141414',
      addonBg: '#262626',
      colorBorder: '#434343',
      activeBorderColor: '#1890ff',
      hoverBorderColor: '#177ddc',
    },
    Select: {
      colorBgContainer: '#141414',
      colorBgElevated: '#262626',
      colorBorder: '#434343',
      optionSelectedBg: '#111b26',
    },
    Popover: {
      colorBgElevated: '#262626',
    },
    Tooltip: {
      colorBgSpotlight: '#434343',
      colorTextLightSolid: '#ffffff',
    },
    Modal: {
      contentBg: '#1f1f1f',
      headerBg: '#1f1f1f',
    },
    Button: {
      defaultBg: '#1f1f1f',
      defaultBorderColor: '#434343',
      defaultColor: '#e8e8e8',
    },
    Tag: {
      defaultBg: '#262626',
      defaultColor: '#e8e8e8',
    },
  },
};
