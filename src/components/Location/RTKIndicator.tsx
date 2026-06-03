/**
 * RTK 状态指示器组件 v1.3.6
 * 显示 RTK 固定解状态、卫星数量、精度等信息
 */

import { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Tag, Progress } from 'antd';
import { SignalFilled, ClockCircleOutlined } from '@ant-design/icons';
import { useCORSStore } from '../../store';
import type { FixType } from '../../types/location';

export function RTKIndicator() {
  const rtkStatus = useCORSStore((state) => state.rtkStatus);
  const ntripStatus = useCORSStore((state) => state.ntripStatus);
  const connectionStatus = useCORSStore((state) => state.connectionStatus);
  const ephemerisLoading = useCORSStore((state) => state.ephemerisLoading);
  const ephemerisFailed = useCORSStore((state) => state.ephemerisFailed);

  // 加载动画效果 - 当 ephemerisLoading 为 false 时自动重置为空字符串
  const [loadingDots, setLoadingDots] = useState('');
  
  useEffect(() => {
    if (!ephemerisLoading) {
      return;
    }

    const interval = setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      clearInterval(interval);
      // 清理时重置状态
      setLoadingDots('');
    };
  }, [ephemerisLoading]);

  // 调试日志
  console.log('[RTKIndicator] 渲染状态:', {
    connectionStatus,
    ephemerisLoading,
    ephemerisFailed,
    rtkStatus,
    satellitesWithEphemeris: rtkStatus?.satellitesWithEphemeris,
  });

  /**
   * 获取固定解类型配置
   */
  const getFixTypeConfig = (fixType: FixType) => {
    const configs = {
      NONE:  { color: 'default',    text: '无解',     icon: '❌',  accuracy: '' },
      SPP:   { color: 'warning',    text: '单点定位', icon: '📡',  accuracy: '5-10m' },
      DGPS:  { color: 'cyan',       text: '差分定位', icon: '📍',  accuracy: '1-3m' },
      FLOAT: { color: 'processing', text: '浮动解',   icon: '🔄',  accuracy: '0.2-0.5m' },
      FIXED: { color: 'success',    text: '固定解',   icon: '🎯',  accuracy: '0.01-0.05m' },
      SBAS:  { color: 'blue',       text: 'SBAS',    icon: '🛰️', accuracy: '1-3m' },
      PPP:   { color: 'purple',     text: 'PPP',     icon: '🛰️', accuracy: '0.1m' },
      DR:    { color: 'default',    text: '航迹推算', icon: '➡️',  accuracy: '10m+' },
    };
    return configs[fixType];
  };

  /**
   * 获取质量等级颜色
   */
  const getQualityColor = (quality: string) => {
    const colors = {
      excellent: '#52c41a',
      good: '#1890ff',
      fair: '#faad14',
      poor: '#ff4d4f',
    };
    return colors[quality as keyof typeof colors] || '#d9d9d9';
  };

  // 如果未连接，显示提示
  if (connectionStatus !== 'connected') {
    return (
      <Card title="RTK 状态">
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <p>未连接 CORS 基站</p>
          <p style={{ fontSize: '12px' }}>请先在 CORS 管理中连接基站</p>
        </div>
      </Card>
    );
  }

  const fixConfig = rtkStatus ? getFixTypeConfig(rtkStatus.fixType) : null;

  return (
    <Card 
      title="RTK 状态"
    >
        <Row gutter={[16, 16]}>
          {/* 定位质量综合卡片 - 占据整行 */}
          <Col span={24}>
            <Card size="small">
              <Row gutter={16} align="middle">
                {/* HDOP 和 VDOP 容器 */}
                <Col span={12}>
                  <Row gutter={32}>
                    <Col span={12}>
                      <Statistic
                        title="HDOP"
                        value={rtkStatus?.hdop.toFixed(2) || '-'}
                        valueStyle={{
                          color: (rtkStatus?.hdop || 99) < 2 ? '#52c41a' : (rtkStatus?.hdop || 99) < 5 ? '#faad14' : '#ff4d4f',
                          fontSize: 28,
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="VDOP"
                        value={rtkStatus?.vdop.toFixed(2) || '-'}
                        valueStyle={{
                          color: (rtkStatus?.vdop || 99) < 3 ? '#52c41a' : (rtkStatus?.vdop || 99) < 6 ? '#faad14' : '#ff4d4f',
                          fontSize: 28,
                        }}
                      />
                    </Col>
                  </Row>
                </Col>

                {/* 圆形进度条容器 */}
                <Col span={12}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Progress
                      type="circle"
                      percent={
                        rtkStatus?.quality === 'excellent' ? 100 :
                        rtkStatus?.quality === 'good' ? 75 :
                        rtkStatus?.quality === 'fair' ? 50 : 25
                      }
                      strokeColor={getQualityColor(rtkStatus?.quality || 'poor')}
                      format={() => {
                        const labels = {
                          excellent: '优秀',
                          good: '良好',
                          fair: '一般',
                          poor: '较差',
                        };
                        return labels[rtkStatus?.quality || 'poor'];
                      }}
                      width={80}
                    />
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 固定解状态 */}
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="固定解类型"
                value={fixConfig?.text || '-'}
                prefix={fixConfig?.icon}
                suffix={
                  fixConfig?.accuracy ? (
                    <Tag color={fixConfig?.color}>
                      {fixConfig?.accuracy}
                    </Tag>
                  ) : undefined
                }
              />
            </Card>
          </Col>

          {/* 卫星数量 */}
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="卫星数量"
                value={rtkStatus?.satelliteCount || 0}
                prefix={<SignalFilled />}
                suffix="颗"
              />
            </Card>
          </Col>

          {/* 星历状态 */}
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="星历状态"
                value={
                  ephemerisLoading ? `加载中${loadingDots}` :
                  ephemerisFailed ? '失败' :
                  rtkStatus?.satellitesWithEphemeris || 0
                }
                prefix={ephemerisLoading ? undefined : ephemerisFailed ? '❌' : '📡'}
                suffix={!ephemerisLoading && !ephemerisFailed ? `/ ${rtkStatus?.satelliteCount || 0}` : ''}
                styles={{
                  content: {
                    color: 
                      ephemerisLoading ? '#1890ff' :
                      ephemerisFailed ? '#ff4d4f' :
                      (rtkStatus?.ephemerisReady) ? '#52c41a' : '#faad14',
                  },
                }}
              />
            </Card>
          </Col>

          {/* 差分龄期 */}
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="差分龄期"
                value={rtkStatus?.age.toFixed(1) || '-'}
                prefix={<ClockCircleOutlined />}
                suffix="秒"
                styles={{
                  content: {
                    color: (rtkStatus?.age || 0) > 10 ? '#ff4d4f' : '#52c41a',
                  },
                }}
              />
            </Card>
          </Col>

          {/* NTRIP 状态 */}
          {ntripStatus && (
            <Col span={24}>
              <Card size="small" title="NTRIP 连接">
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="信号强度"
                      value={ntripStatus.signalStrength}
                      suffix="%"
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="延迟"
                      value={ntripStatus.latency}
                      suffix="ms"
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="数据速率"
                      value={(ntripStatus.dataRate / 1024).toFixed(1)}
                      suffix="KB/s"
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          )}
        </Row>
      </Card>
  );
}
