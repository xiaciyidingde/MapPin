import JSZip from 'jszip';
import type { MeasurementFile, MeasurementPoint } from '../types';
import type { ExportConfig } from '../components/FileUpload/ExportConfigModal';

/**
 * 导出单个文件
 */
export function exportFile(
  file: MeasurementFile,
  points: MeasurementPoint[],
  config: ExportConfig
): void {
  // 过滤点位
  let filteredPoints = points;
  if (!config.includeControlPoints) {
    filteredPoints = filteredPoints.filter((p) => p.type !== 'control');
  }

  // 生成文件内容
  const content = generateFileContent(filteredPoints, config);

  // 使用自定义文件名或默认文件名
  const fileName = config.fileName ? `${config.fileName}.dat` : file.name;

  // 触发下载
  downloadFile(fileName, content);
}

/**
 * 导出多个文件（打包成 ZIP）
 */
export async function exportMultipleFiles(
  filesWithPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[] }>,
  config: ExportConfig
): Promise<void> {
  const zip = new JSZip();
  
  // 生成说明文件内容
  const readmeContent = generateReadmeContent(filesWithPoints, config);
  zip.file('说明.txt', readmeContent);

  // 为每个文件生成独立的 .dat 文件
  for (const { file, points } of filesWithPoints) {
    // 过滤点位
    let filteredPoints = points;
    if (!config.includeControlPoints) {
      filteredPoints = filteredPoints.filter((p) => p.type !== 'control');
    }

    // 生成文件内容
    const fileContent = generateFileContent(filteredPoints, config);
    
    // 添加到 ZIP
    zip.file(file.name, fileContent);
  }

  // 生成 ZIP 文件并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `导出数据_${timestamp}.zip`;
  
  downloadBlob(fileName, blob);
}

/**
 * 生成说明文件内容
 */
function generateReadmeContent(
  filesWithPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[] }>,
  config: ExportConfig
): string {
  const lines: string[] = [];
  
  lines.push('MapPin 数据导出说明');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`文件数量: ${filesWithPoints.length}`);
  lines.push('');
  
  lines.push('导出配置:');
  lines.push(`  - 包含控制点: ${config.includeControlPoints ? '是' : '否'}`);
  lines.push(`  - 包含碎部点: 是（必选）`);
  lines.push(`  - 包含质量参数: ${config.includeQualityParams ? '是' : '否'}`);
  lines.push('');
  
  lines.push('文件列表:');
  lines.push('-'.repeat(50));
  
  for (let i = 0; i < filesWithPoints.length; i++) {
    const { file, points } = filesWithPoints[i];
    
    // 过滤点位
    let filteredPoints = points;
    if (!config.includeControlPoints) {
      filteredPoints = filteredPoints.filter((p) => p.type !== 'control');
    }
    
    const controlCount = filteredPoints.filter(p => p.type === 'control').length;
    const surveyCount = filteredPoints.filter(p => p.type === 'survey').length;
    
    lines.push('');
    lines.push(`${i + 1}. ${file.name}`);
    lines.push(`   上传时间: ${new Date(file.uploadTime).toLocaleString('zh-CN')}`);
    lines.push(`   坐标系统: ${file.coordinateSystem}`);
    lines.push(`   投影方式: ${file.projectionConfig.projectionType === 'gauss-3' ? '高斯投影 3°带' : '高斯投影 6°带'}`);
    lines.push(`   中央经线: ${file.projectionConfig.centralMeridian}°E`);
    lines.push(`   点位总数: ${filteredPoints.length}`);
    lines.push(`     - 控制点: ${controlCount}`);
    lines.push(`     - 碎部点: ${surveyCount}`);
    lines.push(`   数据格式: ${config.includeQualityParams && file.format === 'detailed' ? '详细格式（含质量参数）' : '简单格式（仅坐标）'}`);
  }
  
  lines.push('');
  lines.push('-'.repeat(50));
  lines.push('');
  lines.push('注意事项:');
  lines.push('1. 所有坐标均为投影坐标（单位：米）');
  lines.push('2. 文件格式为 CASS 兼容的 .dat 格式');
  lines.push('3. 简单格式: 点号,,X,Y,Z');
  lines.push('4. 详细格式: 点号,,X,Y,Z,参数1,参数2,...');
  lines.push('');
  lines.push('MapPin - 测量数据管理工具');
  
  return lines.join('\n');
}

/**
 * 生成文件内容
 */
function generateFileContent(
  points: MeasurementPoint[],
  config: ExportConfig
): string {
  const lines: string[] = [];

  for (const point of points) {
    if (config.includeQualityParams && point.qualityParams) {
      // 详细格式：包含质量参数
      lines.push(formatDetailedLine(point));
    } else {
      // 简单格式：只包含基本坐标
      lines.push(formatSimpleLine(point));
    }
  }

  return lines.join('\n');
}

/**
 * 格式化简单格式行
 * 格式：点号,,X,Y,Z
 */
function formatSimpleLine(point: MeasurementPoint): string {
  return `${point.pointNumber},,${point.x},${point.y},${point.z}`;
}

/**
 * 格式化详细格式行
 * 格式：点号,,X,Y,Z,HRMS:xxx,VRMS:xxx,STATUS:xxx,...
 */
function formatDetailedLine(point: MeasurementPoint): string {
  const parts = [
    point.pointNumber,
    '',
    point.x.toString(),
    point.y.toString(),
    point.z.toString(),
  ];

  if (point.qualityParams) {
    // 添加质量参数
    const params = point.qualityParams;
    
    // 常见参数顺序
    const paramOrder = [
      'hrms',
      'vrms',
      'status',
      'sats',
      'age',
      'pdop',
      'hdop',
      'vdop',
      'tdop',
      'gdop',
      'nrms',
      'erms',
      'date',
      'time',
    ];

    for (const key of paramOrder) {
      if (params[key] !== undefined) {
        parts.push(`${key.toUpperCase()}:${params[key]}`);
      }
    }

    // 添加其他未列出的参数
    for (const [key, value] of Object.entries(params)) {
      if (!paramOrder.includes(key.toLowerCase())) {
        parts.push(`${key.toUpperCase()}:${value}`);
      }
    }
  }

  return parts.join(',');
}

/**
 * 触发文件下载
 */
function downloadFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(fileName, blob);
}

/**
 * 触发 Blob 下载
 */
function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
