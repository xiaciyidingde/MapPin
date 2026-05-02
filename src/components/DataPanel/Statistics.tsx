import { Card, Statistic, Row, Col } from 'antd';
import { FileTextOutlined, AimOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useDataStore, useMapStore } from '../../store';

export function Statistics() {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const files = useDataStore((state) => state.files);

  const currentFile = files.find((f) => f.id === currentFileId);

  if (!currentFile) {
    return null;
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <Card size="small" className="shadow-sm">
        <Row gutter={[8, 8]}>
          <Col span={8}>
            <Statistic
              title="总点数"
              value={currentFile.pointCount}
              prefix={<FileTextOutlined />}
              styles={{ content: { fontSize: '1.25rem' } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="控制点"
              value={currentFile.controlPointCount}
              styles={{ content: { color: '#cf1322', fontSize: '1.25rem' } }}
              prefix={<AimOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="碎部点"
              value={currentFile.surveyPointCount}
              styles={{ content: { color: '#1677ff', fontSize: '1.25rem' } }}
              prefix={<EnvironmentOutlined />}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
}
