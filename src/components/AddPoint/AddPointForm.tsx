import { useState, useEffect, useMemo } from 'react';
import { Form, Input, InputNumber, App, Button, Space, Select, Radio } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { useDataStore, useMapStore } from '../../store';
import { validatePointNumber } from '../../utils/pointValidation';
import { convertCoordinatesForFile } from '../../utils/coordinateUtils';
import { useNextPointNumber } from '../../hooks/useNextPointNumber';
import { isValidPointNumber } from '../../utils/sanitize';
import { coordinateConverter } from '../../services/coordinateConverter';
import { decimalToDMS, decimalToDM, dmsToDecimal, dmToDecimal } from '../../utils/coordinateFormatUtils';
import type { MeasurementPoint, PointType } from '../../types';

type CoordinateFormat = 'dd' | 'dm' | 'dms' | 'xy';

interface AddPointFormProps {
  onClose: () => void;
}

export function AddPointForm({ onClose }: AddPointFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>('dd');
  const [pointType, setPointType] = useState<PointType>('survey');
  
  const currentFileId = useMapStore((state) => state.currentFileId);
  const userLocation = useMapStore((state) => state.userLocation);
  const userLocationAccuracy = useMapStore((state) => state.userLocationAccuracy);
  const setView = useMapStore((state) => state.setView);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);
  
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const addPoint = useDataStore((state) => state.addPoint);
  const recalculateFileStats = useDataStore((state) => state.recalculateFileStats);

  // 缓存当前文件
  const currentFile = useMemo(
    () => files.find(f => f.id === currentFileId),
    [files, currentFileId]
  );

  // 使用 Hook 生成下一个点位号
  const nextPointNumber = useNextPointNumber(currentFileId);

  // 当组件挂载时初始化表单
  useEffect(() => {
    if (currentFileId) {
      form.setFieldsValue({
        pointNumber: nextPointNumber,
        z: 0,
      });
    }
  }, [currentFileId, form, nextPointNumber]);

  // 填充当前位置
  const handleFillLocation = () => {
    if (!userLocation) {
      message.warning('无法获取当前位置');
      return;
    }

    if (coordinateFormat === 'dd') {
      // 十进制度格式
      form.setFieldsValue({
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
    } else if (coordinateFormat === 'dms') {
      // 度分秒格式
      const latDMS = decimalToDMS(userLocation.lat, true);
      const lngDMS = decimalToDMS(userLocation.lng, false);
      form.setFieldsValue({
        latDeg: latDMS.degrees,
        latMin: latDMS.minutes,
        latSec: latDMS.seconds,
        latDir: latDMS.direction,
        lngDeg: lngDMS.degrees,
        lngMin: lngDMS.minutes,
        lngSec: lngDMS.seconds,
        lngDir: lngDMS.direction,
      });
    } else if (coordinateFormat === 'dm') {
      // 度分格式
      const latDM = decimalToDM(userLocation.lat, true);
      const lngDM = decimalToDM(userLocation.lng, false);
      form.setFieldsValue({
        latDeg: latDM.degrees,
        latMin: latDM.minutes,
        latDir: latDM.direction,
        lngDeg: lngDM.degrees,
        lngMin: lngDM.minutes,
        lngDir: lngDM.direction,
      });
    } else {
      // 平面投影坐标格式
      if (!currentFile) {
        message.warning('无法获取文件投影配置');
        return;
      }
      const projected = convertCoordinatesForFile(userLocation.lat, userLocation.lng, currentFile);
      form.setFieldsValue({
        x: projected.x,
        y: projected.y,
      });
    }
    message.success('已填充当前位置');
  };

  // 切换坐标格式时清空坐标输入
  const handleFormatChange = (format: CoordinateFormat) => {
    setCoordinateFormat(format);
    form.setFieldsValue({
      lat: undefined,
      lng: undefined,
      latDeg: undefined,
      latMin: undefined,
      latSec: undefined,
      latDir: undefined,
      lngDeg: undefined,
      lngMin: undefined,
      lngSec: undefined,
      lngDir: undefined,
      x: undefined,
      y: undefined,
    });
  };

  // 处理添加
  const handleAdd = async () => {
    if (!currentFileId) {
      message.warning('请先打开文件');
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);

      const currentPoints = points.get(currentFileId) || [];
      
      if (!currentFile) {
        message.error('文件不存在');
        setLoading(false);
        return;
      }

      // 验证点号格式
      if (!isValidPointNumber(values.pointNumber)) {
        message.error('点号格式不正确，只允许字母、数字、中文、下划线和连字符');
        setLoading(false);
        return;
      }

      // 检查点位号是否重复
      const validation = validatePointNumber(values.pointNumber, currentPoints);
      if (!validation.valid) {
        message.error(validation.error);
        setLoading(false);
        return;
      }

      let lat: number, lng: number, x: number, y: number;

      if (coordinateFormat === 'dd') {
        // 十进制度格式：直接使用，并转换为投影坐标
        lat = values.lat;
        lng = values.lng;
        const projected = convertCoordinatesForFile(lat, lng, currentFile);
        x = projected.x;
        y = projected.y;
      } else if (coordinateFormat === 'dms') {
        // 度分秒格式：转换为十进制度，再转换为投影坐标
        lat = dmsToDecimal(values.latDeg, values.latMin, values.latSec, values.latDir);
        lng = dmsToDecimal(values.lngDeg, values.lngMin, values.lngSec, values.lngDir);
        const projected = convertCoordinatesForFile(lat, lng, currentFile);
        x = projected.x;
        y = projected.y;
      } else if (coordinateFormat === 'dm') {
        // 度分格式：转换为十进制度，再转换为投影坐标
        lat = dmToDecimal(values.latDeg, values.latMin, values.latDir);
        lng = dmToDecimal(values.lngDeg, values.lngMin, values.lngDir);
        const projected = convertCoordinatesForFile(lat, lng, currentFile);
        x = projected.x;
        y = projected.y;
      } else {
        // 平面投影坐标格式：直接使用，并转换为经纬度
        x = values.x;
        y = values.y;
        const latLng = coordinateConverter.projectToWGS84(
          x,
          y,
          currentFile.coordinateSystem,
          currentFile.projectionConfig.projectionType,
          currentFile.projectionConfig.centralMeridian
        );
        lat = latLng.lat;
        lng = latLng.lng;
      }

      // 判断用户是否使用了当前位置
      const isUsingCurrentLocation = 
        userLocation &&
        coordinateFormat === 'dd' &&
        values.lat === userLocation.lat && 
        values.lng === userLocation.lng;

      // 创建新点位
      const maxOrder = currentPoints.length > 0 
        ? Math.max(...currentPoints.map(p => p.order))
        : -1;

      const newPoint: MeasurementPoint = {
        id: uuidv4(),
        fileId: currentFileId,
        pointNumber: values.pointNumber,
        originalPointNumber: values.pointNumber,
        code: values.code || undefined,
        x,
        y,
        z: values.z,
        lat,
        lng,
        type: pointType,
        order: maxOrder + 1,
        isManuallyAdded: true,
        qualityParams: isUsingCurrentLocation && userLocationAccuracy
          ? {
              hrms: userLocationAccuracy,
              vrms: undefined,
            }
          : undefined,
      };

      // 添加点位
      await addPoint(currentFileId, newPoint);

      // 重新计算文件统计
      await recalculateFileStats(currentFileId);

      message.success(`已添加点位 ${values.pointNumber}`);
      
      // 定位到新点位
      setView({ lat, lng }, 19);
      setSelectedPointId(newPoint.id);
      
      // 关闭并重置表单
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('添加点位失败:', error);
      message.error('添加点位失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
        >
        <Form.Item style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 100, flexShrink: 0 }}>点号</span>
            <Form.Item
              name="pointNumber"
              rules={[{ required: true, message: '请输入点号' }]}
              style={{ flex: 1, marginBottom: 0 }}
              noStyle
            >
              <Input placeholder="请输入点号" />
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 100, flexShrink: 0 }}>编码</span>
            <Form.Item
              name="code"
              style={{ flex: 1, marginBottom: 0 }}
              noStyle
            >
              <Input placeholder="请输入编码（可选）" />
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 100, flexShrink: 0 }}>类型</span>
            <Radio.Group
              value={pointType}
              onChange={(e) => setPointType(e.target.value)}
              style={{ flex: 1 }}
            >
              <Radio.Button value="survey" style={{ width: '50%', textAlign: 'center' }}>碎部点</Radio.Button>
              <Radio.Button value="control" style={{ width: '50%', textAlign: 'center' }}>控制点</Radio.Button>
            </Radio.Group>
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 100, flexShrink: 0 }}>坐标</span>
            <Button
              type="link"
              size="small"
              icon={<AimOutlined />}
              onClick={handleFillLocation}
              style={{ padding: 0, height: 'auto', flexShrink: 0 }}
            >
              定位
            </Button>
            <Select
              value={coordinateFormat}
              onChange={handleFormatChange}
              options={[
                { label: '十进制度 (DD)', value: 'dd' },
                { label: '度分 (DM)', value: 'dm' },
                { label: '度分秒 (DMS)', value: 'dms' },
                { label: '平面投影坐标', value: 'xy' },
              ]}
              style={{ flex: 1 }}
            />
          </div>
        </Form.Item>

        {coordinateFormat === 'dd' && (
          <>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 100, flexShrink: 0 }}>纬度</span>
                <Form.Item
                  name="lat"
                  rules={[
                    { required: true, message: '请输入纬度' },
                    { type: 'number', min: -90, max: 90, message: '纬度范围：-90 到 90' }
                  ]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="请输入纬度"
                    precision={6}
                  />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 100, flexShrink: 0 }}>经度</span>
                <Form.Item
                  name="lng"
                  rules={[
                    { required: true, message: '请输入经度' },
                    { type: 'number', min: -180, max: 180, message: '经度范围：-180 到 180' }
                  ]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="请输入经度"
                    precision={6}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </>
        )}

        {coordinateFormat === 'dm' && (
          <>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, flexShrink: 0 }}>纬度</span>
                <Form.Item
                  name="latDeg"
                  rules={[{ required: true, message: '度' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="度"
                    min={0}
                    max={90}
                    precision={0}
                  />
                </Form.Item>
                <span>°</span>
                <Form.Item
                  name="latMin"
                  rules={[{ required: true, message: '分' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="分"
                    min={0}
                    max={60}
                    precision={3}
                  />
                </Form.Item>
                <span>'</span>
                <Form.Item
                  name="latDir"
                  rules={[{ required: true, message: '方向' }]}
                  style={{ width: 70, marginBottom: 0 }}
                  noStyle
                >
                  <Select
                    options={[
                      { label: 'N', value: 'N' },
                      { label: 'S', value: 'S' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, flexShrink: 0 }}>经度</span>
                <Form.Item
                  name="lngDeg"
                  rules={[{ required: true, message: '度' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="度"
                    min={0}
                    max={180}
                    precision={0}
                  />
                </Form.Item>
                <span>°</span>
                <Form.Item
                  name="lngMin"
                  rules={[{ required: true, message: '分' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="分"
                    min={0}
                    max={60}
                    precision={3}
                  />
                </Form.Item>
                <span>'</span>
                <Form.Item
                  name="lngDir"
                  rules={[{ required: true, message: '方向' }]}
                  style={{ width: 70, marginBottom: 0 }}
                  noStyle
                >
                  <Select
                    options={[
                      { label: 'E', value: 'E' },
                      { label: 'W', value: 'W' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </>
        )}

        {coordinateFormat === 'dms' && (
          <>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, flexShrink: 0 }}>纬度</span>
                <Form.Item
                  name="latDeg"
                  rules={[{ required: true, message: '度' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="度"
                    min={0}
                    max={90}
                    precision={0}
                  />
                </Form.Item>
                <span>°</span>
                <Form.Item
                  name="latMin"
                  rules={[{ required: true, message: '分' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="分"
                    min={0}
                    max={60}
                    precision={0}
                  />
                </Form.Item>
                <span>'</span>
                <Form.Item
                  name="latSec"
                  rules={[{ required: true, message: '秒' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="秒"
                    min={0}
                    max={60}
                    precision={2}
                  />
                </Form.Item>
                <span>"</span>
                <Form.Item
                  name="latDir"
                  rules={[{ required: true, message: '方向' }]}
                  style={{ width: 70, marginBottom: 0 }}
                  noStyle
                >
                  <Select
                    options={[
                      { label: 'N', value: 'N' },
                      { label: 'S', value: 'S' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, flexShrink: 0 }}>经度</span>
                <Form.Item
                  name="lngDeg"
                  rules={[{ required: true, message: '度' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="度"
                    min={0}
                    max={180}
                    precision={0}
                  />
                </Form.Item>
                <span>°</span>
                <Form.Item
                  name="lngMin"
                  rules={[{ required: true, message: '分' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="分"
                    min={0}
                    max={60}
                    precision={0}
                  />
                </Form.Item>
                <span>'</span>
                <Form.Item
                  name="lngSec"
                  rules={[{ required: true, message: '秒' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="秒"
                    min={0}
                    max={60}
                    precision={2}
                  />
                </Form.Item>
                <span>"</span>
                <Form.Item
                  name="lngDir"
                  rules={[{ required: true, message: '方向' }]}
                  style={{ width: 70, marginBottom: 0 }}
                  noStyle
                >
                  <Select
                    options={[
                      { label: 'E', value: 'E' },
                      { label: 'W', value: 'W' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </>
        )}

        {coordinateFormat === 'xy' && (
          <>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 100, flexShrink: 0 }}>X 坐标 (m)</span>
                <Form.Item
                  name="x"
                  rules={[{ required: true, message: '请输入 X 坐标' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="请输入 X 坐标"
                    precision={3}
                  />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 100, flexShrink: 0 }}>Y 坐标 (m)</span>
                <Form.Item
                  name="y"
                  rules={[{ required: true, message: '请输入 Y 坐标' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                  noStyle
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="请输入 Y 坐标"
                    precision={3}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 100, flexShrink: 0 }}>高程 (m)</span>
            <Form.Item
              name="z"
              rules={[{ required: true, message: '请输入高程' }]}
              style={{ flex: 1, marginBottom: 0 }}
              noStyle
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入高程"
                precision={3}
              />
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>
              取消
            </Button>
            <Button type="primary" onClick={handleAdd} loading={loading}>
              添加
            </Button>
          </Space>
        </Form.Item>
      </Form>
      </div>
    </div>
  );
}
