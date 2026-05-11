import { Form, InputNumber, Space, Select, Input, Alert, Button, message } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import { useSettingsStore } from '../../store';
import { MAP_TILE_SOURCES, getMapTileSourceList } from '../../config/mapTileSources';
import { appConfig } from '../../config/appConfig';
import { isValidApiKey, sanitizeApiKey } from '../../utils/sanitize';

export function GlobalSettings() {
  const [showToken, setShowToken] = useState(false);
  
  // 检查是否有公共 Token
  const hasPublicTokens = useMemo(() => {
    return appConfig.map.tianDiTuTokens && appConfig.map.tianDiTuTokens.length > 0;
  }, []);
  
  // 地图设置
  const mapTileSource = useSettingsStore((state) => state.mapTileSource);
  const setMapTileSource = useSettingsStore((state) => state.setMapTileSource);
  const apiKeys = useSettingsStore((state) => state.apiKeys);
  const setApiKey = useSettingsStore((state) => state.setApiKey);
  
  // 异常检测设置
  const hrmsThreshold = useSettingsStore((state) => state.hrmsThreshold);
  const setHrmsThreshold = useSettingsStore((state) => state.setHrmsThreshold);
  const vrmsThreshold = useSettingsStore((state) => state.vrmsThreshold);
  const setVrmsThreshold = useSettingsStore((state) => state.setVrmsThreshold);
  const duplicateCoordinateTolerance = useSettingsStore((state) => state.duplicateCoordinateTolerance);
  const setDuplicateCoordinateTolerance = useSettingsStore((state) => state.setDuplicateCoordinateTolerance);
  const isolatedPointRangeMultiplier = useSettingsStore((state) => state.isolatedPointRangeMultiplier);
  const setIsolatedPointRangeMultiplier = useSettingsStore((state) => state.setIsolatedPointRangeMultiplier);
  
  // 文件限制
  const maxPointsPerFile = useSettingsStore((state) => state.maxPointsPerFile);
  const setMaxPointsPerFile = useSettingsStore((state) => state.setMaxPointsPerFile);

  const mapSources = getMapTileSourceList();
  const currentSource = MAP_TILE_SOURCES[mapTileSource];
  const requiresToken = currentSource?.requiresToken;

  // 处理 API Key 输入
  const handleApiKeyChange = (key: 'tianditu' | 'amap', value: string) => {
    const sanitized = sanitizeApiKey(value);
    
    // 如果清理后的值与原值不同，提示用户
    if (sanitized !== value && value.length > 0) {
      message.warning('API Key 包含非法字符，已自动清理');
    }
    
    // 验证格式
    if (sanitized && !isValidApiKey(sanitized)) {
      message.error('API Key 格式不正确，只允许字母、数字、下划线和连字符，长度不超过100字符');
      return;
    }
    
    setApiKey(key as 'tianditu' | 'amap', sanitized);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* 地图源设置 */}
        <div className="text-sm text-gray-600 mb-4">
          🗺️ 地图源设置
        </div>
        <Form layout="vertical">
          <Form.Item 
            label="地图瓦片源" 
            tooltip="选择地图底图来源，推荐使用天地图（国内访问快）"
          >
            <Select
              value={mapTileSource}
              onChange={setMapTileSource}
              options={mapSources.map(source => ({
                value: source.id,
                label: (
                  <div>
                    <div>{source.name}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {source.description}
                    </div>
                  </div>
                ),
              }))}
            />
          </Form.Item>

          {requiresToken && (
            <>
              {!apiKeys.tianditu && (
                <Alert
                  description={
                    <div>
                      <p style={{ marginBottom: 12, fontWeight: 500 }}>
                        📍 关于天地图
                      </p>
                      <p style={{ marginBottom: 8 }}>
                        天地图是国家地理信息公共服务平台，由国家测绘地理信息局主办，提供权威、准确的地理信息服务。
                      </p>
                      <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
                        <li>✅ 官方权威数据源</li>
                        <li>✅ 国内访问速度快</li>
                        <li>✅ 免费申请个人 Token</li>
                      </ul>
                      
                      {!hasPublicTokens ? (
                        <>
                          <p style={{ marginTop: 12, fontWeight: 500, color: '#ff4d4f' }}>
                            ⚠️ 未配置公共 Token
                          </p>
                          <p style={{ marginBottom: 8 }}>
                            当前应用未配置公共天地图 Token，请使用您自己的 Token。
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ marginTop: 12, fontWeight: 500 }}>
                            ⚠️ 关于默认 Token
                          </p>
                          <p style={{ marginBottom: 8 }}>
                            系统内置的默认 Token 为多人共享，可能会遇到以下问题：
                          </p>
                          <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
                            <li>访问速度慢（多人同时使用）</li>
                            <li>请求失败（超出配额限制）</li>
                            <li>地图加载不稳定（每秒请求数（QPS）超出）</li>
                          </ul>
                        </>
                      )}
                      
                      <p style={{ marginTop: 12, fontWeight: 500 }}>
                        <strong>💡 {hasPublicTokens ? '强烈建议' : '请'}申请个人免费 Token（仅需 10 分钟），使用自己的配额，无需担心访问失败</strong>
                      </p>
                      <p style={{ marginTop: 8 }}>
                        申请地址：<a href="https://cloudcenter.tianditu.gov.cn/center/development/myApp" target="_blank" rel="noopener noreferrer">https://cloudcenter.tianditu.gov.cn/center/development/myApp</a>
                      </p>
                      <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        注册后申请成为开发者（免费），在"应用管理"中创建应用，选择"浏览器端"类型即可获取 Token，将获取到的 Token 粘贴到下方输入框即可使用自己的配额
                      </p>
                    </div>
                  }
                  type={hasPublicTokens ? 'info' : 'warning'}
                  style={{ marginBottom: 16 }}
                />
              )}
              <Form.Item 
                label="天地图 Token（可选）" 
                tooltip={hasPublicTokens ? "留空则使用系统默认 Token，输入个人 Token 可获得更好的服务质量" : "请输入您的个人 Token"}
              >
                <Input
                  value={apiKeys.tianditu || ''}
                  onChange={(e) => handleApiKeyChange('tianditu', e.target.value)}
                  placeholder={hasPublicTokens ? "留空使用默认 Token，或输入个人 Token" : "请输入您的天地图 Token"}
                  type="text"
                  autoComplete="off"
                  maxLength={100}
                  style={{
                    fontFamily: showToken ? 'inherit' : 'monospace',
                    letterSpacing: showToken ? 'normal' : '0.2em',
                    WebkitTextSecurity: showToken ? 'none' : 'disc',
                  } as React.CSSProperties}
                  suffix={
                    <Button
                      type="text"
                      icon={showToken ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowToken(!showToken)}
                      style={{ padding: '4px 8px' }}
                    />
                  }
                />
              </Form.Item>
            </>
          )}
        </Form>

        {/* 异常检测设置 */}
        <div className="text-sm text-gray-600 mb-4" style={{ marginTop: 32 }}>
          💡 异常检测阈值设置
        </div>
        <Form layout="vertical">
        <Form.Item label="水平精度阈值（HRMS）" tooltip="超过此值的点将被标记为精度异常">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              value={hrmsThreshold}
              min={0.001}
              max={1}
              step={0.001}
              style={{ width: '100%' }}
              onChange={(value) => value != null && setHrmsThreshold(value)}
            />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderLeft: 0,
              background: '#fafafa',
              color: 'rgba(0, 0, 0, 0.25)'
            }}>
              m
            </div>
          </Space.Compact>
        </Form.Item>

        <Form.Item label="垂直精度阈值（VRMS）" tooltip="超过此值的点将被标记为精度异常">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              value={vrmsThreshold}
              min={0.001}
              max={1}
              step={0.001}
              style={{ width: '100%' }}
              onChange={(value) => value != null && setVrmsThreshold(value)}
            />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderLeft: 0,
              background: '#fafafa',
              color: 'rgba(0, 0, 0, 0.25)'
            }}>
              m
            </div>
          </Space.Compact>
        </Form.Item>

        <Form.Item label="重复坐标容差" tooltip="坐标差异小于此值的点将被标记为重复">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              value={duplicateCoordinateTolerance}
              min={0.0001}
              max={0.1}
              step={0.0001}
              style={{ width: '100%' }}
              onChange={(value) => value != null && setDuplicateCoordinateTolerance(value)}
            />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderLeft: 0,
              background: '#fafafa',
              color: 'rgba(0, 0, 0, 0.25)'
            }}>
              m
            </div>
          </Space.Compact>
        </Form.Item>

        <Form.Item label="孤立点检测倍数" tooltip="距离测绘范围中心超过此倍数×范围半径的点将被标记为孤立点">
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              value={isolatedPointRangeMultiplier}
              min={1}
              max={50}
              step={1}
              style={{ width: '100%' }}
              onChange={(value) => value != null && setIsolatedPointRangeMultiplier(value)}
            />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderLeft: 0,
              background: '#fafafa',
              color: 'rgba(0, 0, 0, 0.25)'
            }}>
              倍
            </div>
          </Space.Compact>
        </Form.Item>
      </Form>

        {/* 文件限制设置 */}
        <div className="text-sm text-gray-600 mb-4" style={{ marginTop: 32 }}>
          📁 文件限制设置
        </div>
        <Form layout="vertical">
        <Form.Item 
          label="文件最大点位数量" 
          tooltip="超过此数量的文件将被拒绝上传和加载，防止性能问题"
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              value={maxPointsPerFile}
              min={100}
              max={5000}
              step={100}
              style={{ width: '100%' }}
              onChange={(value) => value != null && setMaxPointsPerFile(value)}
            />
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderLeft: 0,
              background: '#fafafa',
              color: 'rgba(0, 0, 0, 0.25)'
            }}>
              点
            </div>
          </Space.Compact>
        </Form.Item>
      </Form>
      </div>
    </div>
  );
}
