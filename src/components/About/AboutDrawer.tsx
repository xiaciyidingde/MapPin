import { Card, Typography, Space, Button, theme } from 'antd';
import { GithubOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { VERSION } from '../../version';
import { appConfig, type LinkItem } from '../../config/appConfig';
import { getInstallPrompt, isPWA } from '../../utils/registerSW';

const { Title, Paragraph, Link } = Typography;

export function AboutDrawer() {
  const { token } = theme.useToken();
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set());
  const [showInstallButton, setShowInstallButton] = useState(!isPWA());
  const installPrompt = getInstallPrompt();

  // 从配置文件加载链接
  const links: LinkItem[] = appConfig.author.links;
  const showAuthor = appConfig.author.show;
  const showLinks = appConfig.author.showLinks;

  const handleFaviconError = (url: string) => {
    setFailedFavicons(prev => new Set(prev).add(url));
  };

  const handleInstall = async () => {
    const accepted = await installPrompt.showInstallPrompt();
    if (accepted) {
      setShowInstallButton(false);
    }
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
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title level={4} style={{ marginTop: 0, color: token.colorText }}>{appConfig.app.name}</Title>
                <Paragraph style={{ color: token.colorTextSecondary, marginBottom: 0 }}>
                  {appConfig.app.description}
                </Paragraph>
              </div>
              {showInstallButton && installPrompt.isInstallable() && (
                <div style={{ flexShrink: 0 }}>
                  <Button 
                    type="primary" 
                    icon={<DownloadOutlined />}
                    onClick={handleInstall}
                  >
                    安装
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* 版本信息 */}
          <Card>
            {showAuthor && (
              <Paragraph style={{ color: token.colorTextSecondary, fontSize: 16, marginBottom: 8 }}>
                <span style={{ fontWeight: 500, color: token.colorText }}>作者：</span>夏次一定de
              </Paragraph>
            )}
            <Paragraph style={{ color: token.colorTextSecondary, fontSize: 16, marginBottom: 0 }}>
              <span style={{ fontWeight: 500, color: token.colorText }}>版本：</span>{VERSION}
            </Paragraph>
          </Card>

          {/* 相关链接 - 根据配置决定是否显示 */}
          {showLinks && links.length > 0 && (
            <Card>
              <Title level={4} style={{ marginTop: 0, marginBottom: 16, color: token.colorText }}>相关链接</Title>
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
                        borderColor: token.colorBorder,
                      }}
                      styles={{ body: { padding: '16px' } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flexShrink: 0 }}>
                          {link.favicon ? (
                            failedFavicons.has(link.favicon) ? (
                              <span style={{ color: token.colorPrimary, fontSize: 24 }}>🌐</span>
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
                            <GithubOutlined style={{ fontSize: 24, color: token.colorText }} />
                          ) : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: 16, 
                            fontWeight: 500, 
                            color: token.colorText,
                            marginBottom: 4
                          }}>
                            {link.title}
                          </div>
                          <div style={{ 
                            fontSize: 14, 
                            color: token.colorTextTertiary,
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
