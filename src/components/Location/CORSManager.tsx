/**
 * CORS 连接管理组件
 * 管理 CORS 配置的增删改查和连接
 */

import { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Space, Tag, Modal, App, Empty } from 'antd';
import { PlusOutlined, SettingOutlined, DeleteOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useCORSStore, useLocationStore } from '../../store';
import type { CORSConfig, FixType, QualityGrade } from '../../types/location';
import { RTK } from '../../plugins/rtk';
import { Capacitor } from '@capacitor/core';

export function CORSManager() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CORSConfig | null>(null);

  // Store 状态
  const configs = useCORSStore((state) => state.configs);
  const currentConfig = useCORSStore((state) => state.currentConfig);
  const connectionStatus = useCORSStore((state) => state.connectionStatus);
  const addConfig = useCORSStore((state) => state.addConfig);
  const updateConfig = useCORSStore((state) => state.updateConfig);
  const deleteConfig = useCORSStore((state) => state.deleteConfig);
  const setCurrentConfig = useCORSStore((state) => state.setCurrentConfig);
  const setConnectionStatus = useCORSStore((state) => state.setConnectionStatus);
  const setEphemerisLoading = useCORSStore((state) => state.setEphemerisLoading);
  const setEphemerisFailed = useCORSStore((state) => state.setEphemerisFailed);
  const setRTKStatus = useCORSStore((state) => state.setRTKStatus);

  /**
   * 打开添加/编辑对话框
   */
  const handleOpenModal = (config?: CORSConfig) => {
    if (config) {
      setEditingConfig(config);
      form.setFieldsValue(config);
    } else {
      setEditingConfig(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingConfig?.id) {
        // 更新现有配置
        updateConfig(editingConfig.id, values);
        message.success('配置已更新');
      } else {
        // 添加新配置
        addConfig(values);
        message.success('配置已添加');
      }
      
      setIsModalOpen(false);
      form.resetFields();
      setEditingConfig(null);
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  };

  /**
   * 删除配置
   */
  const handleDelete = (config: CORSConfig) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除配置"${config.name}"吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        if (config.id) {
          deleteConfig(config.id);
          message.success('配置已删除');
        }
      },
    });
  };

  /**
   * 连接 CORS
   */
  const handleConnect = async (config: CORSConfig) => {
    try {
      setCurrentConfig(config);
      setConnectionStatus('connecting');
      
      console.log('开始连接 CORS:', config);
      
      // 检查是否在原生平台
      if (!Capacitor.isNativePlatform()) {
        message.warning('NTRIP 功能仅在 Android 应用中可用');
        setConnectionStatus('error');
        return;
      }
      
      // 使用 RTK 插件连接，统一 CORS/RTCM/GNSS/调试数据入口
      const result = await RTK.connect({
        host: config.host,
        port: config.port,
        mountpoint: config.mountpoint,
        username: config.username,
        password: config.password,
      });
      
      console.log('RTK/CORS 连接结果:', result);
      
      if (result.success) {
        const startResult = await RTK.startRTKPositioning({ updateInterval: 1000 });
        if (!startResult.success) {
          await RTK.disconnect();
          setConnectionStatus('error');
          message.error('RTK positioning start failed');
          return;
        }

        setConnectionStatus('connected');
        message.success(`已连接到 ${config.name}`);
        
        // 连接成功后，立即设置星历加载状态为 true
        // 因为 RTKProcessor.start() 会立即开始等待星历
        setEphemerisLoading(true);
      } else {
        setConnectionStatus('error');
        message.error(`连接失败: ${result.message}`);
      }
    } catch (error: unknown) {
      setConnectionStatus('error');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`连接失败: ${errorMessage}`);
      console.error('CORS 连接失败:', error);
    }
  };

  /**
   * 断开连接
   */
  const handleDisconnect = () => {
    modal.confirm({
      title: '确认断开',
      content: '确定要断开 CORS 连接吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            await RTK.stopRTKPositioning();
            await RTK.disconnect();
            console.log('NTRIP 已断开');
          }
          
          setConnectionStatus('disconnected');
          setCurrentConfig(null);
          message.info('已断开连接');
        } catch (error) {
          console.error('断开连接失败:', error);
          message.error('断开连接失败');
        }
      },
    });
  };

  /**
   * 应用启动时自动连接上次使用的 CORS
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    // 如果有上次连接的配置且当前未连接，则自动连接
    if (currentConfig && connectionStatus === 'disconnected') {
      console.log('自动连接上次使用的 CORS:', currentConfig.name);
      handleConnect(currentConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  /**
   * 监听星历状态事件（在组件挂载时立即注册）
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[CORSManager] 非原生平台，跳过事件监听');
      return;
    }

    console.log('[CORSManager] 开始监听星历状态事件');

    // 如果已连接，主动查询一次当前状态
    if (connectionStatus === 'connected') {
      console.log('[CORSManager] 已连接，主动查询星历状态');
      // 延迟 100ms 确保监听器已注册
      setTimeout(() => {
        // 通过触发一次状态更新来同步当前状态
        // 这会触发 Java 端发送最新的状态
      }, 100);
    }

    // 监听星历加载状态
    const loadingListener = RTK.addListener('ephemerisLoadingStatus', (data) => {
      console.log('[CORSManager] 收到星历加载状态事件:', data.loading);
      setEphemerisLoading(data.loading);
    });

    // 监听星历失败状态
    const failedListener = RTK.addListener('ephemerisFailedStatus', (data) => {
      console.log('[CORSManager] 收到星历失败状态事件:', data.failed);
      setEphemerisFailed(data.failed);
    });

    // 监听 RTK 状态更新（包含星历数量）
    const statusListener = RTK.addListener('rtkStatusUpdate', (data) => {
      console.log('[CORSManager] 收到 RTK 状态更新事件:', data);
      
      // 根据星历数量自动更新加载状态
      if (data.satellitesWithEphemeris > 0) {
        // 有星历了，停止加载动画
        setEphemerisLoading(false);
        setEphemerisFailed(false);
      }
      
      // 更新 RTK 状态到 Store
      setRTKStatus({
        fixType: data.fixType as FixType,
        satelliteCount: data.satelliteCount,
        age: data.age,
        hdop: data.hdop,
        vdop: data.vdop,
        quality: data.quality as QualityGrade,
        satellitesWithEphemeris: data.satellitesWithEphemeris,
        ephemerisReady: data.ephemerisReady,
      });
    });

    return () => {
      console.log('[CORSManager] 移除星历状态监听器');
      loadingListener.then((l) => l.remove());
      failedListener.then((l) => l.remove());
      statusListener.then((l) => l.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]); // 依赖 connectionStatus，连接状态变化时重新注册

  /**
   * 监听位置更新（RTK 定位结果）
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = RTK.addListener('rtkPositionUpdate', (data: {
      latitude: number;
      longitude: number;
      altitude: number;
      accuracy: number;
      fixType: string;
    }) => {
      console.log('[CORSManager] 收到位置更新:', data);
      
      // 更新到 LocationStore
      const locationStore = useLocationStore.getState();
      locationStore.setCurrentPosition({
        lat: data.latitude,
        lng: data.longitude,
        altitude: data.altitude,
        accuracy: data.accuracy,
        timestamp: Date.now(),
      });
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  /**
   * 获取连接状态标签
   */
  const getStatusTag = (config: CORSConfig) => {
    if (currentConfig?.id === config.id) {
      const statusConfig = {
        connecting: { color: 'processing', text: '连接中' },
        connected: { color: 'success', text: '已连接' },
        error: { color: 'error', text: '连接失败' },
        disconnected: { color: 'default', text: '未连接' },
      };
      const status = statusConfig[connectionStatus];
      return <Tag color={status.color}>{status.text}</Tag>;
    }
    return null;
  };

  return (
    <div>
      <Card
        title="CORS 配置管理"
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            添加配置
          </Button>
        }
      >
        {configs.length === 0 ? (
          <Empty description="暂无 CORS 配置，点击上方按钮添加" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {configs.map((config) => (
              <Card
                key={config.id}
                size="small"
                style={{ width: '100%' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* 左侧信息 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <span style={{ fontSize: 16, fontWeight: 500 }}>{config.name}</span>
                        {getStatusTag(config)}
                      </Space>
                    </div>
                    <div style={{ color: '#666', fontSize: 14 }}>
                      <div>服务器: {config.host}:{config.port}</div>
                      <div>挂载点: {config.mountpoint}</div>
                    </div>
                  </div>

                  {/* 右侧按钮容器 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {currentConfig?.id === config.id && connectionStatus === 'connected' ? (
                      <Button
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={handleDisconnect}
                      >
                        断开
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        onClick={() => handleConnect(config)}
                        loading={currentConfig?.id === config.id && connectionStatus === 'connecting'}
                      >
                        连接
                      </Button>
                    )}
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                      <Button
                        icon={<SettingOutlined />}
                        onClick={() => handleOpenModal(config)}
                      />
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(config)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* 添加/编辑配置对话框 */}
      <Modal
        title={editingConfig ? '编辑 CORS 配置' : '添加 CORS 配置'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setEditingConfig(null);
        }}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          colon={false}
          requiredMark={false}
        >
          <Form.Item
            label="配置名称"
            name="name"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="配置名称" />
          </Form.Item>

          <Form.Item
            label="服务器地址"
            name="host"
            rules={[{ required: true, message: '请输入服务器地址' }]}
          >
            <Input placeholder="服务器地址" />
          </Form.Item>

          <Form.Item
            label="端口"
            name="port"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={65535}
              placeholder="端口"
            />
          </Form.Item>

          <Form.Item
            label="挂载点"
            name="mountpoint"
            rules={[{ required: true, message: '请输入挂载点' }]}
          >
            <Input placeholder="挂载点" />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
