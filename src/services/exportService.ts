import JSZip from 'jszip';
import type { MeasurementFile, MeasurementPoint } from '../types';

// 导出配置类型
export interface ExportOptions {
  format: 'simple' | 'detailed';
  includeControl: boolean;
  includeSurvey: boolean;
  includeManual: boolean;
  swapXY: boolean;
}

/**
 * 导出单个文件
 */
export function exportFile(
  file: MeasurementFile,
  points: MeasurementPoint[],
  options: ExportOptions,
  fileName?: string
): void {
  // 过滤点位
  const filteredPoints = filterPointsByType(points, options);

  // 生成文件内容
  const content = generateFileContent(filteredPoints, options);

  // 使用自定义文件名或默认文件名
  const finalFileName = fileName ? `${fileName}.dat` : file.name;

  // 触发下载
  downloadFile(finalFileName, content);
}

/**
 * 导出多个文件（打包成 ZIP）
 */
export async function exportMultipleFiles(
  filesWithPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[] }>,
  options: ExportOptions,
  zipFileName?: string
): Promise<void> {
  const zip = new JSZip();
  
  // 预先过滤所有文件的点位，避免重复过滤
  const filesWithFilteredPoints = filesWithPoints.map(({ file, points }) => ({
    file,
    points,
    filteredPoints: filterPointsByType(points, options),
  }));
  
  // 生成说明文件内容（传入已过滤的点位）
  const readmeContent = generateReadmeContent(filesWithFilteredPoints, options);
  zip.file('说明.txt', readmeContent);

  // 用于跟踪文件名使用情况
  const fileNameCount = new Map<string, number>();

  // 为每个文件生成独立的 .dat 文件
  for (const { file, filteredPoints } of filesWithFilteredPoints) {
    // 生成文件内容（使用已过滤的点位）
    const fileContent = generateFileContent(filteredPoints, options);
    
    // 处理重名文件：如果文件名已存在，添加序号
    let finalFileName = file.name;
    const baseName = file.name.replace(/\.dat$/i, '');
    const count = fileNameCount.get(file.name) || 0;
    
    if (count > 0) {
      // 文件名已存在，添加序号
      finalFileName = `${baseName}_${count + 1}.dat`;
    }
    
    // 更新计数
    fileNameCount.set(file.name, count + 1);
    
    // 添加到 ZIP
    zip.file(finalFileName, fileContent);
  }

  // 生成 ZIP 文件并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const finalFileName = zipFileName ? `${zipFileName}.zip` : `导出数据_${timestamp}.zip`;
  
  downloadBlob(finalFileName, blob);
}

/**
 * 根据类型过滤点位
 */
function filterPointsByType(points: MeasurementPoint[], options: ExportOptions): MeasurementPoint[] {
  return points.filter(point => {
    // 手动添加点优先判断（作为独立类型）
    if (point.isManuallyAdded) {
      return options.includeManual;
    }
    
    // 文件导入的控制点
    if (point.type === 'control') {
      return options.includeControl;
    }
    
    // 文件导入的碎步点
    if (point.type === 'survey') {
      return options.includeSurvey;
    }
    
    return false;
  });
}

/**
 * 生成说明文件内容
 */
function generateReadmeContent(
  filesWithFilteredPoints: Array<{ file: MeasurementFile; points: MeasurementPoint[]; filteredPoints: MeasurementPoint[] }>,
  options: ExportOptions
): string {
  const lines: string[] = [];
  
  lines.push('MapPin 数据导出说明');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`文件数量: ${filesWithFilteredPoints.length}`);
  lines.push('');
  
  lines.push('导出配置:');
  lines.push(`  - 文件格式: ${options.format === 'simple' ? '简单格式' : '详细格式'}`);
  lines.push(`  - 包含控制点: ${options.includeControl ? '是' : '否'}`);
  lines.push(`  - 包含碎步点: ${options.includeSurvey ? '是' : '否'}`);
  lines.push(`  - 包含手动添加点: ${options.includeManual ? '是' : '否'}`);
  lines.push(`  - 交换X/Y坐标: ${options.swapXY ? '是' : '否'}`);
  lines.push('');
  
  lines.push('文件列表:');
  lines.push('-'.repeat(50));
  
  for (let i = 0; i < filesWithFilteredPoints.length; i++) {
    const { file, filteredPoints } = filesWithFilteredPoints[i];
    
    // 使用单次遍历统计点位类型
    let controlCount = 0;
    let surveyCount = 0;
    let manualCount = 0;
    
    for (const point of filteredPoints) {
      if (point.isManuallyAdded) {
        manualCount++;
      } else if (point.type === 'control') {
        controlCount++;
      } else if (point.type === 'survey') {
        surveyCount++;
      }
    }
    
    lines.push('');
    lines.push(`${i + 1}. ${file.name}`);
    lines.push(`   上传时间: ${new Date(file.uploadTime).toLocaleString('zh-CN')}`);
    lines.push(`   坐标系统: ${file.coordinateSystem}`);
    lines.push(`   投影方式: ${file.projectionConfig.projectionType === 'gauss-3' ? '高斯投影 3°带' : '高斯投影 6°带'}`);
    lines.push(`   中央经线: ${file.projectionConfig.centralMeridian}°E`);
    lines.push(`   点位总数: ${filteredPoints.length}`);
    lines.push(`     - 控制点: ${controlCount}`);
    lines.push(`     - 碎步点: ${surveyCount}`);
    lines.push(`     - 手动添加: ${manualCount}`);
    lines.push(`   数据格式: ${options.format === 'detailed' ? '详细格式（含完整信息）' : '简单格式（仅坐标）'}`);
  }
  
  lines.push('');
  lines.push('-'.repeat(50));
  lines.push('');
  lines.push('注意事项:');
  lines.push('1. 所有坐标均为投影坐标（单位：米）');
  lines.push('2. 文件格式为 CASS 兼容的 .dat 格式');
  lines.push('3. 简单格式: 点号,编码,X,Y,Z');
  lines.push('4. 详细格式: 点号,编码,X,Y,Z,类型,经度,纬度,...');
  lines.push('');
  lines.push('MapPin - 测量数据管理工具');
  
  return lines.join('\n');
}

/**
 * 生成文件内容
 */
function generateFileContent(
  points: MeasurementPoint[],
  options: ExportOptions
): string {
  const lines: string[] = [];

  for (const point of points) {
    if (options.format === 'detailed') {
      // 详细格式：包含完整信息
      lines.push(formatDetailedLine(point, options.swapXY));
    } else {
      // 简单格式：只包含基本坐标
      lines.push(formatSimpleLine(point, options.swapXY));
    }
  }

  return lines.join('\n');
}

/**
 * 格式化简单格式行
 * 格式：点号,编码,X,Y,Z
 */
function formatSimpleLine(point: MeasurementPoint, swapXY: boolean = false): string {
  const x = swapXY ? point.y : point.x;
  const y = swapXY ? point.x : point.y;
  return `${point.pointNumber},${point.code || ''},${x},${y},${point.z}`;
}

/**
 * 格式化详细格式行
 * 格式：点号,编码,X,Y,Z,类型,经度,纬度,质量参数...
 */
function formatDetailedLine(point: MeasurementPoint, swapXY: boolean = false): string {
  const x = swapXY ? point.y : point.x;
  const y = swapXY ? point.x : point.y;
  
  const parts = [
    point.pointNumber,
    point.code || '',
    x.toString(),
    y.toString(),
    point.z.toString(),
    point.type === 'control' ? '控制点' : '碎步点',
  ];

  // 添加经纬度（如果有）
  if (point.lat !== undefined && point.lng !== undefined) {
    parts.push(point.lat.toFixed(8));
    parts.push(point.lng.toFixed(8));
  } else {
    parts.push('');
    parts.push('');
  }

  // 添加质量参数（如果有）
  if (point.qualityParams) {
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
