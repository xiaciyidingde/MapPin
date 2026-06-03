import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Progress, theme, App } from 'antd';
import { DatabaseOutlined, StopOutlined, DownloadOutlined } from '@ant-design/icons';
import { OfflineDebugCollector } from '../../plugins/offlineDebugCollector';
import LogCollector from '../../plugins/logCollector';
import { Capacitor } from '@capacitor/core';

const { Text, Title } = Typography;

/**
 * 提取错误消息（兼容 Error 对象与字符串）
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '未知错误';
}

/**
 * 离线调试数据收集组件
 * 用于收集 GNSS 观测数据、星历文件、RTCM 消息用于离线调试
 */
export const OfflineDebugCollectorComponent: React.FC = () => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [obsCount, setObsCount] = useState(0);
  const [rtcmCount, setRtcmCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloading, setDownloading] = useState(false);
  // 平台判断在渲染期同步计算，避免 useEffect 内调 setState 触发级联渲染
  const isAndroid = Capacitor.getPlatform() === 'android';
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();

  // 组件挂载时查询后端状态，同步前后端状态
  useEffect(() => {
    if (!isAndroid) return;

    const syncStatus = async () => {
      try {
        const status = await OfflineDebugCollector.getStatus();
        setIsCollecting(status.isCollecting);
        setObsCount(status.obsCount);
        setRtcmCount(status.rtcmCount);
        setDuration(status.duration || 0);
      } catch (error) {
        console.error('同步收集状态失败:', error);
      }
    };

    syncStatus();
  }, [isAndroid]);

  useEffect(() => {
    if (!isCollecting) return;

    // 定期更新状态
    const interval = setInterval(async () => {
      try {
        const status = await OfflineDebugCollector.getStatus();
        setObsCount(status.obsCount);
        setRtcmCount(status.rtcmCount);
        setDuration(status.duration || 0);
      } catch (error) {
        console.error('获取收集状态失败:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isCollecting]);

  const handleStart = async () => {
    try {
      const result = await OfflineDebugCollector.startCollection();
      if (result.success) {
        setIsCollecting(true);
        setObsCount(0);
        setRtcmCount(0);
        setDuration(0);
        message.success('开始收集调试数据');
      } else {
        message.error('启动收集失败');
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      
      // 如果后端已经在收集中，同步前端状态
      if (errorMsg.includes('已经在收集')) {
        try {
          const status = await OfflineDebugCollector.getStatus();
          setIsCollecting(status.isCollecting);
          setObsCount(status.obsCount);
          setRtcmCount(status.rtcmCount);
          setDuration(status.duration || 0);
          message.info('数据收集正在进行中');
        } catch {
          message.error(`启动收集失败: ${errorMsg}`);
        }
      } else {
        message.error(`启动收集失败: ${errorMsg}`);
      }
    }
  };

  const handleStop = async () => {
    modal.confirm({
      title: '停止收集并分享',
      content: '确定要停止收集并打包分享数据吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await OfflineDebugCollector.stopAndShare();
          if (result.success) {
            setIsCollecting(false);
            message.success(
              `收集完成！观测: ${result.obsCount}, RTCM: ${result.rtcmCount}, 时长: ${result.duration}秒`
            );
          } else {
            message.error('停止收集失败');
          }
        } catch (error: unknown) {
          message.error(`停止收集失败: ${getErrorMessage(error)}`);
        }
      },
    });
  };

  /**
   * 分享日志文件
   */
  const handleShareLog = async () => {
    setDownloading(true);
    const hide = message.loading('正在准备日志文件...', 0);

    try {
      const result = await LogCollector.openLogFile();
      
      if (!result.success) {
        throw new Error(result.message || '分享日志文件失败');
      }

      hide();
      message.success('请选择应用查看或分享日志');
      
    } catch (error: unknown) {
      hide();
      message.error(`分享日志失败: ${getErrorMessage(error)}`);
    } finally {
      setDownloading(false);
    }
  };

  if (!isAndroid) {
    return (
      <Card>
        <Text type="secondary">离线调试收集功能仅在 Android 平台可用</Text>
      </Card>
    );
  }

  const obsProgress = Math.min((obsCount / 300) * 100, 100);
  const rtcmProgress = Math.min((rtcmCount / 1000) * 100, 100);

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          <span>离线调试数据收集</span>
        </Space>
      }
      extra={
        isCollecting ? (
          <Text type="danger">收集中...</Text>
        ) : (
          <Text type="secondary">未收集</Text>
        )
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text type="secondary">
            收集 GNSS 原始观测数据、星历文件和 RTCM 消息，用于离线调试和分析。
          </Text>
        </div>

        {isCollecting && (
          <>
            <div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>观测历元: {obsCount} / 300</Text>
                  <Progress percent={obsProgress} status="active" showInfo={false} />
                </div>
                <div>
                  <Text>RTCM 消息: {rtcmCount} / 1000</Text>
                  <Progress percent={rtcmProgress} status="active" showInfo={false} />
                </div>
                <div>
                  <Text>收集时长: {duration} 秒</Text>
                </div>
              </Space>
            </div>
          </>
        )}

        <Space>
          {!isCollecting ? (
            <>
              <Button
                type="primary"
                icon={<DatabaseOutlined />}
                onClick={handleStart}
                style={{ backgroundColor: token.colorPrimary }}
              >
                开始收集
              </Button>
              <Button
                icon={<DownloadOutlined />}
                loading={downloading}
                onClick={handleShareLog}
                style={{ backgroundColor: token.colorPrimary, color: '#fff' }}
              >
                分享日志
              </Button>
            </>
          ) : (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
            >
              停止并分享
            </Button>
          )}
        </Space>

        <div>
          <Title level={5}>说明</Title>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>最多收集 300 个观测历元（约 5 分钟）</li>
            <li>最多收集 1000 条 RTCM 消息</li>
            <li>自动打包星历文件（SP3、NAV）</li>
            <li>生成 ZIP 文件并通过分享功能导出</li>
            <li>数据可用于 RTKLIB 工具离线分析</li>
          </ul>
        </div>
      </Space>
    </Card>
  );
};
