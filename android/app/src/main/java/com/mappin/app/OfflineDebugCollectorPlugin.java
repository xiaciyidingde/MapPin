package com.mappin.app;

import android.content.Context;
import android.content.Intent;
import android.location.GnssClock;
import android.location.GnssMeasurement;
import android.location.GnssMeasurementsEvent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 离线调试数据收集器
 *
 * <p>架构：纯 POJO 工具类，不直接作为 Capacitor 插件注册。
 * 由 {@link RTKPlugin} 统一暴露给 JS 端，处理 PluginCall 的 resolve/reject。
 *
 * <p>负责收集：
 * <ul>
 *   <li>GNSS 原始观测数据（自定义文本格式，可用 tools/obs2rinex.py 转 RINEX）</li>
 *   <li>RTCM 基站数据（十六进制文本，可用于离线重放）</li>
 *   <li>星历文件（SP3 / NAV，从 cache 目录复制）</li>
 * </ul>
 *
 * <p>数据打包成 ZIP 后通过系统分享 Intent 导出。
 */
public class OfflineDebugCollectorPlugin {
    private static final String TAG = "OfflineDebugCollector";
    private static final int MAX_OBSERVATIONS = 300;     // 最多收集 300 个观测历元（约 5 分钟）
    private static final int MAX_RTCM_MESSAGES = 1000;   // 最多收集 1000 条 RTCM 消息（约 5 分钟）

    private final Context context;
    private File debugDir;
    private File obsFile;
    private File rtcmFile;
    private File infoFile;
    private FileWriter obsWriter;
    private FileWriter rtcmWriter;

    private int obsCount = 0;
    private int rtcmCount = 0;
    private boolean isCollecting = false;
    private long startTime = 0;

    public OfflineDebugCollectorPlugin(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("Context 不能为空");
        }
        this.context = context;
        initDebugDirectory();
    }

    /**
     * 初始化调试数据目录
     */
    private void initDebugDirectory() {
        try {
            File baseDir = context.getExternalFilesDir(null);
            if (baseDir == null) {
                baseDir = context.getFilesDir();
            }

            debugDir = new File(baseDir, "offline_debug");
            if (!debugDir.exists()) {
                boolean created = debugDir.mkdirs();
                Log.i(TAG, "创建调试数据目录: " + debugDir.getAbsolutePath() + ", 结果: " + created);
            }

            Log.i(TAG, "调试数据目录: " + debugDir.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "初始化调试数据目录失败", e);
        }
    }

    /**
     * 开始收集调试数据
     *
     * @return 包含 success / sessionDir 字段的 JSObject
     * @throws IOException 文件创建失败时抛出
     * @throws IllegalStateException 已经在收集中时抛出
     */
    public JSObject startCollection() throws IOException {
        if (isCollecting) {
            throw new IllegalStateException("已经在收集数据中");
        }

        // 确保调试目录已初始化
        if (debugDir == null) {
            initDebugDirectory();
        }
        if (debugDir == null || !debugDir.exists()) {
            throw new IOException("无法创建调试数据目录");
        }

        // 创建时间戳目录
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        File sessionDir = new File(debugDir, "session_" + timestamp);

        if (!sessionDir.exists() && !sessionDir.mkdirs()) {
            throw new IOException("无法创建会话目录: " + sessionDir.getAbsolutePath());
        }

        Log.i(TAG, "会话目录已创建: " + sessionDir.getAbsolutePath());

        // 创建数据文件
        obsFile = new File(sessionDir, "observations.txt");
        rtcmFile = new File(sessionDir, "rtcm_messages.txt");
        infoFile = new File(sessionDir, "info.txt");

        // 创建文件写入器
        obsWriter = new FileWriter(obsFile);
        rtcmWriter = new FileWriter(rtcmFile);

        // 写入信息文件
        writeInfoFile();

        // 写入观测文件头
        writeObservationHeader();

        // 写入 RTCM 文件头
        writeRTCMHeader();

        isCollecting = true;
        obsCount = 0;
        rtcmCount = 0;
        startTime = System.currentTimeMillis();

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("sessionDir", sessionDir.getAbsolutePath());

        Log.i(TAG, "开始收集调试数据: " + sessionDir.getAbsolutePath());
        return result;
    }

    /**
     * 停止收集并打包分享
     *
     * @return 包含 success / obsCount / rtcmCount / duration / zipFile 字段的 JSObject
     * @throws IOException 文件操作失败时抛出
     * @throws IllegalStateException 没有正在进行的收集时抛出
     */
    public JSObject stopAndShare() throws IOException {
        if (!isCollecting) {
            throw new IllegalStateException("没有正在进行的收集");
        }

        // 关闭文件
        if (obsWriter != null) {
            obsWriter.close();
            obsWriter = null;
        }
        if (rtcmWriter != null) {
            rtcmWriter.close();
            rtcmWriter = null;
        }

        isCollecting = false;

        // 复制星历文件
        copyEphemerisFiles();
        
        // 复制应用日志文件
        copyLogFile();

        // 打包成 ZIP
        File zipFile = createZipPackage();

        // 分享 ZIP 文件（失败不抛异常，已收集的数据仍可后续访问）
        shareZipFile(zipFile);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("obsCount", obsCount);
        result.put("rtcmCount", rtcmCount);
        result.put("duration", (System.currentTimeMillis() - startTime) / 1000);
        result.put("zipFile", zipFile.getAbsolutePath());

        Log.i(TAG, "收集完成: 观测=" + obsCount + ", RTCM=" + rtcmCount);
        return result;
    }

    /**
     * 获取收集状态
     *
     * @return 包含 isCollecting / obsCount / rtcmCount / [duration] 字段的 JSObject
     */
    public JSObject getStatus() {
        JSObject result = new JSObject();
        result.put("isCollecting", isCollecting);
        result.put("obsCount", obsCount);
        result.put("rtcmCount", rtcmCount);
        if (isCollecting) {
            result.put("duration", (System.currentTimeMillis() - startTime) / 1000);
        }
        return result;
    }

    /**
     * 释放资源（在 RTKPlugin.handleOnDestroy 中调用）
     */
    public void release() {
        if (isCollecting) {
            try {
                if (obsWriter != null) obsWriter.close();
                if (rtcmWriter != null) rtcmWriter.close();
            } catch (IOException e) {
                Log.e(TAG, "关闭文件失败", e);
            }
            isCollecting = false;
        }
    }

    /**
     * 记录 GNSS 观测数据
     */
    public void recordObservation(GnssMeasurementsEvent event) {
        if (!isCollecting || obsWriter == null || obsCount >= MAX_OBSERVATIONS) {
            return;
        }

        try {
            GnssClock clock = event.getClock();

            // 写入时钟信息
            obsWriter.write(String.format("EPOCH %d\n", obsCount + 1));
            obsWriter.write(String.format("TimeNanos: %d\n", clock.getTimeNanos()));
            obsWriter.write(String.format("FullBiasNanos: %d\n", clock.getFullBiasNanos()));
            obsWriter.write(String.format("BiasNanos: %.3f\n", clock.getBiasNanos()));
            obsWriter.write(String.format("BiasUncertaintyNanos: %.3f\n", clock.getBiasUncertaintyNanos()));
            obsWriter.write(String.format("DriftNanosPerSecond: %.6f\n", clock.getDriftNanosPerSecond()));
            obsWriter.write(String.format("DriftUncertaintyNanosPerSecond: %.6f\n", clock.getDriftUncertaintyNanosPerSecond()));
            obsWriter.write(String.format("HardwareClockDiscontinuityCount: %d\n", clock.getHardwareClockDiscontinuityCount()));
            obsWriter.write(String.format("MeasurementCount: %d\n", event.getMeasurements().size()));
            obsWriter.write("\n");

            // 写入每个卫星的测量数据
            int index = 0;
            for (GnssMeasurement m : event.getMeasurements()) {
                obsWriter.write(String.format("MEAS %d\n", index++));
                obsWriter.write(String.format("  ConstellationType: %d\n", m.getConstellationType()));
                obsWriter.write(String.format("  Svid: %d\n", m.getSvid()));
                obsWriter.write(String.format("  Cn0DbHz: %.1f\n", m.getCn0DbHz()));
                obsWriter.write(String.format("  ReceivedSvTimeNanos: %d\n", m.getReceivedSvTimeNanos()));
                obsWriter.write(String.format("  ReceivedSvTimeUncertaintyNanos: %d\n", m.getReceivedSvTimeUncertaintyNanos()));
                obsWriter.write(String.format("  PseudorangeRateMetersPerSecond: %.3f\n", m.getPseudorangeRateMetersPerSecond()));
                obsWriter.write(String.format("  PseudorangeRateUncertaintyMetersPerSecond: %.3f\n", m.getPseudorangeRateUncertaintyMetersPerSecond()));
                obsWriter.write(String.format("  AccumulatedDeltaRangeState: 0x%X\n", m.getAccumulatedDeltaRangeState()));
                obsWriter.write(String.format("  AccumulatedDeltaRangeMeters: %.3f\n", m.getAccumulatedDeltaRangeMeters()));
                obsWriter.write(String.format("  AccumulatedDeltaRangeUncertaintyMeters: %.3f\n", m.getAccumulatedDeltaRangeUncertaintyMeters()));
                obsWriter.write(String.format("  CarrierFrequencyHz: %.1f\n", m.hasCarrierFrequencyHz() ? m.getCarrierFrequencyHz() : 0.0));
                obsWriter.write(String.format("  CarrierCycles: %d\n", m.hasCarrierCycles() ? m.getCarrierCycles() : 0));
                obsWriter.write(String.format("  CarrierPhase: %.3f\n", m.hasCarrierPhase() ? m.getCarrierPhase() : 0.0));
                obsWriter.write(String.format("  CarrierPhaseUncertainty: %.3f\n", m.hasCarrierPhaseUncertainty() ? m.getCarrierPhaseUncertainty() : 0.0));
                obsWriter.write(String.format("  MultipathIndicator: %d\n", m.getMultipathIndicator()));
                obsWriter.write(String.format("  SnrInDb: %.1f\n", m.hasSnrInDb() ? m.getSnrInDb() : 0.0));
                obsWriter.write("\n");
            }

            obsWriter.write("END_EPOCH\n\n");
            obsWriter.flush();

            obsCount++;

            if (obsCount >= MAX_OBSERVATIONS) {
                Log.i(TAG, "已达到最大观测数量，停止收集观测数据");
            }

        } catch (IOException e) {
            Log.e(TAG, "记录观测数据失败", e);
        }
    }

    /**
     * 记录 RTCM 消息
     */
    public void recordRTCM(byte[] data, int length) {
        if (!isCollecting || rtcmWriter == null || rtcmCount >= MAX_RTCM_MESSAGES) {
            return;
        }

        try {
            rtcmWriter.write(String.format("MESSAGE %d\n", rtcmCount + 1));
            rtcmWriter.write(String.format("Timestamp: %d\n", System.currentTimeMillis()));
            rtcmWriter.write(String.format("Length: %d\n", length));
            rtcmWriter.write("Data: ");

            // 写入十六进制数据
            for (int i = 0; i < length; i++) {
                rtcmWriter.write(String.format("%02X", data[i] & 0xFF));
                if ((i + 1) % 32 == 0 && i < length - 1) {
                    rtcmWriter.write("\n      ");
                }
            }
            rtcmWriter.write("\n\n");
            rtcmWriter.flush();

            rtcmCount++;

            if (rtcmCount >= MAX_RTCM_MESSAGES) {
                Log.i(TAG, "已达到最大 RTCM 消息数量，停止收集 RTCM 数据");
            }

        } catch (IOException e) {
            Log.e(TAG, "记录 RTCM 数据失败", e);
        }
    }

    /**
     * 写入信息文件
     */
    private void writeInfoFile() throws IOException {
        FileWriter writer = new FileWriter(infoFile);
        try {
            writer.write("================================================================================\n");
            writer.write("MapPin 离线调试数据包\n");
            writer.write("================================================================================\n\n");

            writer.write("收集时间: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()) + "\n\n");

            writer.write("=== 设备信息 ===\n");
            writer.write("设备型号: " + Build.MODEL + "\n");
            writer.write("制造商: " + Build.MANUFACTURER + "\n");
            writer.write("Android 版本: " + Build.VERSION.RELEASE + "\n");
            writer.write("SDK 版本: " + Build.VERSION.SDK_INT + "\n\n");

            writer.write("=== 数据说明 ===\n");
            writer.write("observations.txt - GNSS 原始观测数据（最多 " + MAX_OBSERVATIONS + " 个历元）\n");
            writer.write("rtcm_messages.txt - RTCM 基站数据（最多 " + MAX_RTCM_MESSAGES + " 条消息）\n");
            writer.write("mappin_app.log - 应用运行日志（包含设备能力检测、错误信息等）\n");
            writer.write("ephemeris/ - 星历文件目录\n");
            writer.write("  - *.sp3 - 精密星历文件\n");
            writer.write("  - *.nav / *.rnx - 广播星历文件\n\n");

            writer.write("=== 使用说明 ===\n");
            writer.write("1. 解压此 ZIP 文件\n");
            writer.write("2. 查看 mappin_app.log 了解设备能力和运行状态\n");
            writer.write("3. 用 tools/obs2rinex.py 把 observations.txt 转换为 RINEX 3.04 OBS\n");
            writer.write("   python tools/obs2rinex.py observations.txt output.26O\n");
            writer.write("4. 用 RTKLIB rnx2rtkp 跑 SPP 解算：\n");
            writer.write("   rnx2rtkp -p 0 -m 15 -o out.pos output.26O ephemeris/*.rnx\n");
            writer.write("5. 用 rtkplot 可视化解算结果\n");
            writer.write("6. RTCM 消息为十六进制格式，可用于重放测试\n\n");
            
            writer.write("=== 故障排查 ===\n");
            writer.write("如果 observations.txt 为空或数据很少：\n");
            writer.write("1. 查看 mappin_app.log 中的设备能力检测结果\n");
            writer.write("2. 确认设备是否支持 GNSS 原始测量（查找 'hasGnssMeasurementSupport'）\n");
            writer.write("3. 确认是否在室外空旷处收集数据\n");
            writer.write("4. 检查是否授予了精确位置权限\n\n");
        } finally {
            writer.close();
        }
    }

    /**
     * 写入观测文件头
     */
    private void writeObservationHeader() throws IOException {
        obsWriter.write("# MapPin GNSS 原始观测数据\n");
        obsWriter.write("# 格式版本: 1.0\n");
        obsWriter.write("# 收集时间: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()) + "\n");
        obsWriter.write("# 设备: " + Build.MANUFACTURER + " " + Build.MODEL + "\n");
        obsWriter.write("#\n");
        obsWriter.write("# 数据格式说明:\n");
        obsWriter.write("# EPOCH <序号> - 观测历元开始\n");
        obsWriter.write("# TimeNanos - 接收机时间（纳秒）\n");
        obsWriter.write("# FullBiasNanos - 完整偏差（纳秒）\n");
        obsWriter.write("# BiasNanos - 偏差（纳秒）\n");
        obsWriter.write("# MEAS <序号> - 卫星测量数据\n");
        obsWriter.write("# END_EPOCH - 观测历元结束\n");
        obsWriter.write("#\n\n");
    }

    /**
     * 写入 RTCM 文件头
     */
    private void writeRTCMHeader() throws IOException {
        rtcmWriter.write("# MapPin RTCM 消息数据\n");
        rtcmWriter.write("# 格式版本: 1.0\n");
        rtcmWriter.write("# 收集时间: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()) + "\n");
        rtcmWriter.write("#\n");
        rtcmWriter.write("# 数据格式说明:\n");
        rtcmWriter.write("# MESSAGE <序号> - RTCM 消息开始\n");
        rtcmWriter.write("# Timestamp - 接收时间戳（毫秒）\n");
        rtcmWriter.write("# Length - 消息长度（字节）\n");
        rtcmWriter.write("# Data - 十六进制数据\n");
        rtcmWriter.write("#\n\n");
    }

    /**
     * 复制应用日志文件
     */
    private void copyLogFile() {
        try {
            // 查找日志文件（LogCollectorPlugin 创建的日志）
            File logFile = null;
            
            // 尝试从 ExternalFilesDir 查找
            File externalDir = context.getExternalFilesDir(null);
            if (externalDir != null) {
                File externalLog = new File(externalDir, "mappin_app.log");
                if (externalLog.exists()) {
                    logFile = externalLog;
                }
            }
            
            // 如果没找到，尝试从 FilesDir 查找
            if (logFile == null) {
                File internalLog = new File(context.getFilesDir(), "mappin_app.log");
                if (internalLog.exists()) {
                    logFile = internalLog;
                }
            }
            
            if (logFile != null && logFile.exists()) {
                File sessionDir = obsFile.getParentFile();
                File destLog = new File(sessionDir, "mappin_app.log");
                
                copyFile(logFile, destLog);
                Log.i(TAG, "应用日志已复制: " + logFile.getAbsolutePath() + " → " + destLog.getAbsolutePath());
            } else {
                // 日志文件不存在，创建错误日志
                File sessionDir = obsFile.getParentFile();
                File destLog = new File(sessionDir, "mappin_app.log");
                
                try (FileWriter writer = new FileWriter(destLog)) {
                    writer.write("================================================================================\n");
                    writer.write("MapPin 应用日志 - 错误\n");
                    writer.write("================================================================================\n\n");
                    writer.write("错误: 未找到应用日志文件\n\n");
                    
                    writer.write("搜索的路径:\n");
                    if (externalDir != null) {
                        File externalLog = new File(externalDir, "mappin_app.log");
                        writer.write("- " + externalLog.getAbsolutePath() + " (存在: " + externalLog.exists() + ")\n");
                    }
                    File internalLog = new File(context.getFilesDir(), "mappin_app.log");
                    writer.write("- " + internalLog.getAbsolutePath() + " (存在: " + internalLog.exists() + ")\n");
                    
                    writer.write("\n可能的原因:\n");
                    writer.write("1. LogCollectorPlugin 未正确启动\n");
                    writer.write("2. 日志文件被删除或移动\n");
                    writer.write("3. 文件权限不足\n");
                    writer.write("4. 存储空间不足\n");
                } catch (IOException e) {
                    Log.e(TAG, "创建错误日志失败", e);
                }
                
                Log.w(TAG, "未找到应用日志文件，已创建错误日志");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "复制日志文件失败", e);
            
            // 发生异常时，将异常信息写入日志文件
            try {
                File sessionDir = obsFile.getParentFile();
                File destLog = new File(sessionDir, "mappin_app.log");
                
                try (FileWriter writer = new FileWriter(destLog)) {
                    writer.write("================================================================================\n");
                    writer.write("MapPin 应用日志 - 异常\n");
                    writer.write("================================================================================\n\n");
                    writer.write("复制日志文件时发生异常:\n\n");
                    writer.write("异常类型: " + e.getClass().getName() + "\n");
                    writer.write("异常消息: " + e.getMessage() + "\n\n");
                    writer.write("堆栈跟踪:\n");
                    for (StackTraceElement element : e.getStackTrace()) {
                        writer.write("  at " + element.toString() + "\n");
                    }
                }
            } catch (IOException ioException) {
                Log.e(TAG, "写入异常日志失败", ioException);
            }
        }
    }

    /**
     * 复制星历文件
     */
    private void copyEphemerisFiles() {
        try {
            File ephDir = new File(obsFile.getParentFile(), "ephemeris");
            if (!ephDir.exists() && !ephDir.mkdirs()) {
                Log.w(TAG, "无法创建 ephemeris 子目录");
                return;
            }

            int copiedCount = 0;

            // 星历文件保存在 context.getFilesDir()/ephemeris/
            File ephemerisDir = new File(context.getFilesDir(), "ephemeris");
            
            if (!ephemerisDir.exists() || !ephemerisDir.isDirectory()) {
                Log.w(TAG, "星历目录不存在: " + ephemerisDir.getAbsolutePath());
            } else {
                Log.d(TAG, "搜索星历文件: " + ephemerisDir.getAbsolutePath());

                Log.d(TAG, "搜索星历文件: " + ephemerisDir.getAbsolutePath());

                // 复制 SP3 文件
                File[] sp3Files = ephemerisDir.listFiles((dir, name) -> 
                    name.endsWith(".sp3") || name.endsWith(".SP3") || 
                    name.contains("CAS0MGXULT") || name.contains("WUM0MGXULA"));
                if (sp3Files != null && sp3Files.length > 0) {
                    for (File sp3 : sp3Files) {
                        try {
                            copyFile(sp3, new File(ephDir, sp3.getName()));
                            copiedCount++;
                            Log.i(TAG, "复制 SP3 文件: " + sp3.getName());
                        } catch (IOException e) {
                            Log.w(TAG, "复制 SP3 文件失败: " + sp3.getName(), e);
                        }
                    }
                }

                // 复制 NAV/RINEX 文件
                File[] navFiles = ephemerisDir.listFiles((dir, name) ->
                    name.endsWith(".nav") || name.endsWith(".NAV") || name.endsWith(".n") ||
                    name.endsWith(".rnx") || name.endsWith(".RNX") ||
                    name.contains("BRDM") || name.contains("brdc") || name.contains("BRDC"));
                if (navFiles != null && navFiles.length > 0) {
                    for (File nav : navFiles) {
                        try {
                            copyFile(nav, new File(ephDir, nav.getName()));
                            copiedCount++;
                            Log.i(TAG, "复制 NAV 文件: " + nav.getName());
                        } catch (IOException e) {
                            Log.w(TAG, "复制 NAV 文件失败: " + nav.getName(), e);
                        }
                    }
                }
            }

            if (copiedCount > 0) {
                Log.i(TAG, "星历文件已复制: " + copiedCount + " 个文件 → " + ephDir.getAbsolutePath());
            } else {
                Log.w(TAG, "未找到任何星历文件");
                
                // 创建说明文件
                File readmeFile = new File(ephDir, "README.txt");
                try (FileWriter writer = new FileWriter(readmeFile)) {
                    writer.write("未找到星历文件\n\n");
                    writer.write("可能的原因：\n");
                    writer.write("1. 星历下载失败\n");
                    writer.write("2. 星历文件在加载后被删除\n");
                    writer.write("3. CORS 未提供星历数据\n\n");
                    writer.write("建议：\n");
                    writer.write("1. 检查网络连接\n");
                    writer.write("2. 查看应用日志中的星历下载信息\n");
                    writer.write("3. 确认 CORS 配置是否包含星历消息\n");
                } catch (IOException e) {
                    Log.w(TAG, "创建 README 失败", e);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "复制星历文件失败", e);
        }
    }

    /**
     * 复制文件
     */
    private void copyFile(File src, File dst) throws IOException {
        try (FileInputStream in = new FileInputStream(src);
             FileOutputStream out = new FileOutputStream(dst)) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = in.read(buffer)) > 0) {
                out.write(buffer, 0, length);
            }
        }
    }

    /**
     * 创建 ZIP 打包
     */
    private File createZipPackage() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        File zipFile = new File(debugDir, "mappin_debug_" + timestamp + ".zip");

        try (ZipOutputStream zos = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(zipFile)))) {
            File sessionDir = obsFile.getParentFile();
            zipDirectory(sessionDir, sessionDir.getName(), zos);
        }

        Log.i(TAG, "ZIP 打包完成: " + zipFile.getAbsolutePath());
        return zipFile;
    }

    /**
     * 递归打包目录
     */
    private void zipDirectory(File dir, String baseName, ZipOutputStream zos) throws IOException {
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            String entryName = baseName + "/" + file.getName();

            if (file.isDirectory()) {
                zipDirectory(file, entryName, zos);
            } else {
                ZipEntry entry = new ZipEntry(entryName);
                zos.putNextEntry(entry);

                try (FileInputStream fis = new FileInputStream(file)) {
                    byte[] buffer = new byte[8192];
                    int length;
                    while ((length = fis.read(buffer)) > 0) {
                        zos.write(buffer, 0, length);
                    }
                }

                zos.closeEntry();
            }
        }
    }

    /**
     * 分享 ZIP 文件
     */
    private void shareZipFile(File zipFile) {
        try {
            Uri fileUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                zipFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "MapPin 离线调试数据");
            shareIntent.putExtra(Intent.EXTRA_TEXT, "MapPin 离线调试数据包，包含 GNSS 观测数据、星历文件和 RTCM 消息");
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, "分享调试数据");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(chooser);

        } catch (Exception e) {
            Log.e(TAG, "分享 ZIP 文件失败", e);
        }
    }
}
