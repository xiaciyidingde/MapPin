import { Card, Typography, Space } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { VERSION } from '../../version';
import { appConfig, type LinkItem } from '../../config/appConfig';

const { Title, Paragraph, Link } = Typography;

// 提取常量样式
const CARD_SHADOW = '0 2px 8px rgba(0,0,0,0.06)';
const TEXT_COLOR_PRIMARY = '#262626';
const TEXT_COLOR_SECONDARY = '#595959';
const TEXT_COLOR_TERTIARY = '#8c8c8c';

export function AboutDrawer() {
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set());

  // 从配置文件加载链接
  const links: LinkItem[] = appConfig.author.links;
  const showAuthor = appConfig.author.show;
  const showLinks = appConfig.author.showLinks;

  const handleFaviconError = (url: string) => {
    setFailedFavicons(prev => new Set(prev).add(url));
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      padding: '24px 16px',
      overflow: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%', display: 'flex' }}>
          {/* 项目介绍 */}
          <Card style={{ boxShadow: CARD_SHADOW }}>
            <Title level={4} style={{ marginTop: 0 }}>{appConfig.app.name}</Title>
            <Paragraph style={{ color: TEXT_COLOR_SECONDARY, marginBottom: 0 }}>
              {appConfig.app.description}
            </Paragraph>
          </Card>

          {/* 版本信息 */}
          <Card style={{ boxShadow: CARD_SHADOW }}>
            {showAuthor && (
              <Paragraph style={{ color: TEXT_COLOR_SECONDARY, fontSize: 16, marginBottom: 8 }}>
                <span style={{ fontWeight: 500, color: TEXT_COLOR_PRIMARY }}>作者：</span>夏次一定de
              </Paragraph>
            )}
            <Paragraph style={{ color: TEXT_COLOR_SECONDARY, fontSize: 16, marginBottom: 0 }}>
              <span style={{ fontWeight: 500, color: TEXT_COLOR_PRIMARY }}>版本：</span>{VERSION}
            </Paragraph>
          </Card>

          {/* 相关链接 - 根据配置决定是否显示 */}
          {showLinks && links.length > 0 && (
            <Card style={{ boxShadow: CARD_SHADOW }}>
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>相关链接</Title>
              <Space orientation="vertical" size="middle" style={{ width: '100%', display: 'flex' }}>
                {links.map((link) => (
                  <Link
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', textDecoration: 'none' }}
                  >
                    <Card
                      hoverable
                      style={{
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                      }}
                      styles={{ body: { padding: '16px' } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flexShrink: 0 }}>
                          {link.favicon ? (
                            failedFavicons.has(link.favicon) ? (
                              <span style={{ color: '#1890ff', fontSize: 24 }}>🌐</span>
                            ) : (
                              <img 
                                src={link.favicon} 
                                alt={link.title}
                                style={{ 
                                  width: 24, 
                                  height: 24,
                                  objectFit: 'contain'
                                }}
                                onError={() => handleFaviconError(link.favicon!)}
                              />
                            )
                          ) : link.icon === 'github' ? (
                            <GithubOutlined style={{ fontSize: 24, color: TEXT_COLOR_PRIMARY }} />
                          ) : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: 16, 
                            fontWeight: 500, 
                            color: TEXT_COLOR_PRIMARY,
                            marginBottom: 4
                          }}>
                            {link.title}
                          </div>
                          <div style={{ 
                            fontSize: 14, 
                            color: TEXT_COLOR_TERTIARY,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {link.description}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </Space>
            </Card>
          )}
        </Space>
      </div>
    </div>
  );
}
