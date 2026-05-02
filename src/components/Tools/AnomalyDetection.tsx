import { useMemo, useState } from 'react';
import { Card, Empty, Tag, Button, Statistic, Row, Col, Collapse } from 'antd';
import { WarningOutlined, EnvironmentOutlined, CheckCircleOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { List } from 'react-window';
import type { RowComponentProps } from 'react-window';
import { useDataStore, useMapStore, useSettingsStore } from '../../store';
import { anomalyDetectionService } from '../../services/anomalyDetectionService';
import type { Anomaly } from '../../services/anomalyDetectionService';

interface AnomalyDetectionProps {
  isActive: boolean;
  onLocate?: () => void; // 定位后的回调（用于关闭抽屉）
}

export function AnomalyDetection({ isActive, onLocate: onLocateCallback }: AnomalyDetectionProps) {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const points = useDataStore((state) => state.points);
  const setView = useMapStore((state) => state.setView);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);
  const hrmsThreshold = useSettingsStore((state) => state.hrmsThreshold);
  const vrmsThreshold = useSettingsStore((state) => state.vrmsThreshold);
  const duplicateCoordinateTolerance = useSettingsStore((state) => state.duplicateCoordinateTolerance);
  const isolatedPointRangeMultiplier = useSettingsStore((state) => state.isolatedPointRangeMultiplier);

  const [ignoredAnomalies, setIgnoredAnomalies] = useState<Set<string>>(new Set());

  const currentPoints = useMemo(
    () => (currentFileId ? points.get(currentFileId) || [] : []),
    [currentFileId, points]
  );

  // 只在标签页激活时执行异常检测
  const anomalies = useMemo(() => {
    if (!isActive || currentPoints.length === 0) return [];

    return anomalyDetectionService.detectAll(currentPoints, {
      hrmsThreshold,
      vrmsThreshold,
      duplicateCoordinateTolerance,
      isolatedPointRangeMultiplier,
    });
  }, [isActive, currentPoints, hrmsThreshold, vrmsThreshold, duplicateCoordinateTolerance, isolatedPointRangeMultiplier]);

  // 过滤掉已忽略的异常
  const activeAnomalies = anomalies.filter(
    (a) => !ignoredAnomalies.has(`${a.pointId}-${a.type}`)
  );

  // 按类型分组
  const anomaliesByType = useMemo(() => {
    const groups: Record<string, Anomaly[]> = {
      precision: [],
      isolated: [],
      duplicate: [],
    };

    for (const anomaly of activeAnomalies) {
      groups[anomaly.type].push(anomaly);
    }

    return groups;
  }, [activeAnomalies]);

  // 定位到点位
  const handleLocate = (anomaly: Anomaly) => {
    const point = currentPoints.find((p) => p.id === anomaly.pointId);
    if (point && point.lat && point.lng) {
      setView({ lat: point.lat, lng: point.lng }, 19);
      setSelectedPointId(point.id);
      // 调用回调关闭抽屉
      onLocateCallback?.();
    }
  };

  // 忽略异常
  const handleIgnore = (anomaly: Anomaly) => {
    setIgnoredAnomalies((prev) => new Set(prev).add(`${anomaly.pointId}-${anomaly.type}`));
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'gold';
      default:
        return 'default';
    }
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'precision':
        return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      case 'isolated':
        return <EnvironmentOutlined style={{ color: '#fa8c16' }} />;
      case 'duplicate':
        return <CheckCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return null;
    }
  };

  // 渲染单个异常项（用于虚拟列表）
  const renderAnomalyItem = (anomaly: Anomaly) => (
    <Card size="small" styles={{ body: { padding: '12px' } }} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 20, marginTop: 2 }}>
          {getTypeIcon(anomaly.type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{anomaly.pointNumber}</span>
            <Tag color={getSeverityColor(anomaly.severity)}>
              {anomaly.severity === 'high' ? '严重' : '中等'}
            </Tag>
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
            {anomaly.message}
          </div>
          {anomaly.type === 'precision' && (
            <>
              {anomaly.details.hrms && (
                <div style={{ fontSize: 12, color: '#999' }}>
                  水平精度: {anomaly.details.hrms.toFixed(3)}m (阈值: {anomaly.details.threshold?.toFixed(3)}m)
                </div>
              )}
              {anomaly.details.vrms && (
                <div style={{ fontSize: 12, color: '#999' }}>
                  垂直精度: {anomaly.details.vrms.toFixed(3)}m (阈值: {anomaly.details.threshold?.toFixed(3)}m)
                </div>
              )}
            </>
          )}
          {anomaly.type === 'isolated' && (
            <div style={{ fontSize: 12, color: '#999' }}>
              最近点: {anomaly.details.nearestPoint}
            </div>
          )}
          {anomaly.type === 'duplicate' && anomaly.details.coordinates && (
            <div style={{ fontSize: 12, color: '#999' }}>
              坐标: X={anomaly.details.coordinates.x.toFixed(3)}, Y={anomaly.details.coordinates.y.toFixed(3)}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button size="small" icon={<EnvironmentOutlined />} onClick={() => handleLocate(anomaly)}>
              定位
            </Button>
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => handleIgnore(anomaly)}>
              忽略
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  // 虚拟列表行渲染器
  const VirtualRow = ({ index, style, ariaAttributes, anomalies }: RowComponentProps<{ anomalies: Anomaly[] }> & { anomalies: Anomaly[] }) => {
    const anomaly = anomalies[index];
    return (
      <div style={style} {...ariaAttributes}>
        {renderAnomalyItem(anomaly)}
      </div>
    );
  };

  if (!currentFileId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        请先选择一个文件
      </div>
    );
  }

  if (currentPoints.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        当前文件没有点位数据
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* 统计卡片 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="总点数"
                  value={currentPoints.length}
                  styles={{ 
                    title: { fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' },
                    content: { fontSize: 20, textAlign: 'center' } 
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="异常数"
                  value={activeAnomalies.length}
                  styles={{ 
                    title: { fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' },
                    content: { fontSize: 20, color: activeAnomalies.length > 0 ? '#ff4d4f' : '#52c41a', textAlign: 'center' } 
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="精度"
                  value={anomaliesByType.precision.length}
                  styles={{ 
                    title: { fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' },
                    content: { fontSize: 20, color: '#ff4d4f', textAlign: 'center' } 
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="孤立点"
                  value={anomaliesByType.isolated.length}
                  styles={{ 
                    title: { fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' },
                    content: { fontSize: 20, color: '#fa8c16', textAlign: 'center' } 
                  }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      {/* 异常列表 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {activeAnomalies.length === 0 ? (
            <Empty description="未检测到异常点位" />
          ) : (
            <Collapse
              defaultActiveKey={[
                anomaliesByType.precision.length > 0 ? 'precision' : null,
                anomaliesByType.isolated.length > 0 ? 'isolated' : null,
                anomaliesByType.duplicate.length > 0 ? 'duplicate' : null,
              ].filter(Boolean) as string[]}
              items={[
                ...(anomaliesByType.precision.length > 0 ? [{
                  key: 'precision',
                  label: `精度异常 (${anomaliesByType.precision.length})`,
                  children: (
                    <List
                      style={{ height: Math.min(400, anomaliesByType.precision.length * 160) }}
                      rowCount={anomaliesByType.precision.length}
                      rowHeight={160}
                      rowComponent={(props) => <VirtualRow {...props} anomalies={anomaliesByType.precision} />}
                      rowProps={{ anomalies: anomaliesByType.precision }}
                    />
                  ),
                }] : []),
                ...(anomaliesByType.isolated.length > 0 ? [{
                  key: 'isolated',
                  label: `孤立点 (${anomaliesByType.isolated.length})`,
                  children: (
                    <List
                      style={{ height: Math.min(400, anomaliesByType.isolated.length * 160) }}
                      rowCount={anomaliesByType.isolated.length}
                      rowHeight={160}
                      rowComponent={(props) => <VirtualRow {...props} anomalies={anomaliesByType.isolated} />}
                      rowProps={{ anomalies: anomaliesByType.isolated }}
                    />
                  ),
                }] : []),
                ...(anomaliesByType.duplicate.length > 0 ? [{
                  key: 'duplicate',
                  label: `重复坐标 (${anomaliesByType.duplicate.length})`,
                  children: (
                    <List
                      style={{ height: Math.min(400, anomaliesByType.duplicate.length * 160) }}
                      rowCount={anomaliesByType.duplicate.length}
                      rowHeight={160}
                      rowComponent={(props) => <VirtualRow {...props} anomalies={anomaliesByType.duplicate} />}
                      rowProps={{ anomalies: anomaliesByType.duplicate }}
                    />
                  ),
                }] : []),
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
