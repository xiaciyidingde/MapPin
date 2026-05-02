import { Component, type ReactNode } from 'react';
import { Result, Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { isDevelopment } from '../utils/env';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('错误边界捕获到错误:', error, errorInfo);
    this.setState({ errorInfo });

    // 生产环境可以发送到错误监控服务
    // if (isProduction) {
    //   Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  handleCopyError = () => {
    const errorText = [
      '错误消息:',
      this.state.error?.toString() || '',
      '',
      '堆栈跟踪:',
      this.state.error?.stack || '',
      '',
      '组件堆栈:',
      this.state.errorInfo?.componentStack || '',
    ].join('\n');

    navigator.clipboard.writeText(errorText).then(
      () => {
        message.success('错误信息已复制到剪贴板');
      },
      () => {
        message.error('复制失败');
      }
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#f5f5f5',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Result
              status="error"
              title="应用遇到了一个错误"
              subTitle="抱歉，应用运行时出现了问题。请尝试刷新页面,如果问题持续存在，请联系技术支持。"
              extra={[
                <Button size="large" key="reload" onClick={this.handleReset}>
                  刷新页面
                </Button>,
                <Button size="large" key="home" onClick={this.handleGoHome}>
                  返回首页
                </Button>,
              ]}
            />
            
            {/* 只在开发环境显示详细错误信息 */}
            {isDevelopment && this.state.error && (
              <div
                style={{
                  textAlign: 'left',
                  background: '#fff',
                  padding: '20px',
                  borderRadius: '4px',
                  marginTop: '24px',
                  border: '1px solid #d9d9d9',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, color: '#ff4d4f' }}>
                    ⚠️ 错误详情
                  </h4>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={this.handleCopyError}
                  >
                    复制信息
                  </Button>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#262626' }}>错误消息：</strong>
                  <pre
                    style={{
                      fontSize: '13px',
                      color: '#262626',
                      background: '#f5f5f5',
                      padding: '12px',
                      borderRadius: '4px',
                      marginTop: '4px',
                      overflow: 'auto',
                      lineHeight: '1.6',
                      maxWidth: '100%',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {this.state.error.toString()}
                  </pre>
                </div>

                {this.state.error.stack && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#262626' }}>堆栈跟踪：</strong>
                    <pre
                      style={{
                        fontSize: '12px',
                        color: '#262626',
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        overflow: 'auto',
                        maxHeight: '300px',
                        lineHeight: '1.5',
                        maxWidth: '100%',
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}

                {this.state.errorInfo && (
                  <div>
                    <strong style={{ color: '#262626' }}>组件堆栈：</strong>
                    <pre
                      style={{
                        fontSize: '12px',
                        color: '#262626',
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        overflow: 'auto',
                        maxHeight: '300px',
                        lineHeight: '1.5',
                        maxWidth: '100%',
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
