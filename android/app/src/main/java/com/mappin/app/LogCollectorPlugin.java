package com.mappin.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 日志收集插件
 * 程序启动时创建日志文件，持续写入日志
 * 点击按钮打开日志文件
 */
@CapacitorPlugin(name = "LogCollector")
public class LogCollectorPlugin extends Plugin {
    private static final String TAG = "LogCollectorPlugin";
    private static final String LOG_FILE_NAME = "mappin_app.log";
    
    private File logFile;
    private Thread logThread;
    private volatile boolean isLogging = false;

    @Override
    public void load() {
        super.load();
        startLogging();
    }

    /**
     * 启动日志收集线程
     */
    private void startLogging() {
        try {
            // 创建日志文件（每次启动重置）
            File logDir = getContext().getExternalFilesDir(null);
            if (logDir == null) {
                logDir = getContext().getFilesDir();
            }
            
            logFile = new File(logDir, LOG_FILE_NAME);
            
            // 重置日志文件
            if (logFile.exists()) {
                logFile.delete();
            }
            logFile.createNewFile();
            
            // 写入启动信息
            writeStartupInfo();
            
            // 启动日志收集线程
            isLogging = true;
            logThread = new Thread(new LogCollectorRunnable());
            logThread.start();
            
            Log.i(TAG, "日志收集已启动，文件: " + logFile.getAbsolutePath());
            
        } catch (IOException e) {
            Log.e(TAG, "启动日志收集失败", e);
        }
    }

    /**
     * 写入启动信息
     */
    private void writeStartupInfo() {
        try (FileWriter writer = new FileWriter(logFile, true)) {
            writer.write("=".repeat(80) + "\n");
            writer.write("MapPin 应用日志\n");
            writer.write("启动时间: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()) + "\n");
            writer.write("=".repeat(80) + "\n");
            writer.write("\n");
            
            writer.write("=== 设备信息 ===\n");
            writer.write("设备型号: " + Build.MODEL + "\n");
            writer.write("制造商: " + Build.MANUFACTURER + "\n");
            writer.write("Android 版本: " + Build.VERSION.RELEASE + "\n");
            writer.write("SDK 版本: " + Build.VERSION.SDK_INT + "\n");
            writer.write("\n");
            
            writer.flush();
        } catch (IOException e) {
            Log.e(TAG, "写入启动信息失败", e);
        }
    }

    /**
     * 日志收集线程
     */
    private class LogCollectorRunnable implements Runnable {
        @Override
        public void run() {
            try {
                // 清除旧日志，开始收集新日志
                Process clearProcess = Runtime.getRuntime().exec("logcat -c");
                clearProcess.waitFor();
                clearProcess.destroy();
                
                // 启动 logcat 进程
                Process process = Runtime.getRuntime().exec(new String[]{
                    "logcat", "-v", "time",
                    "NTRIP:*", "NTRIPClient:*", "RTK:*", "RTKLIB:*", "RTKPlugin:*", "RTKProcessor:*",
                    "RTKLIB_JNI:*", "EphemerisDownloader:*",
                    "RTKLibWrapper:*", "LogCollectorPlugin:*", "*:S"
                });

                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream())
                );

                FileWriter writer = new FileWriter(logFile, true);
                
                String line;
                while (isLogging && (line = reader.readLine()) != null) {
                    writer.write(line + "\n");
                    writer.flush();
                }

                writer.close();
                reader.close();
                process.destroy();
                
            } catch (Exception e) {
                Log.e(TAG, "日志收集线程异常", e);
            }
        }
    }

    /**
     * 打开日志文件（通过分享）
     */
    @PluginMethod
    public void openLogFile(PluginCall call) {
        if (logFile == null || !logFile.exists()) {
            call.reject("日志文件不存在");
            return;
        }

        try {
            Context context = getContext();
            
            // 使用 FileProvider 获取文件 URI
            Uri fileUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                logFile
            );

            // 创建分享 Intent
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "MapPin 应用日志");
            shareIntent.putExtra(Intent.EXTRA_TEXT, "MapPin 应用运行日志文件");
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            // 创建选择器
            Intent chooser = Intent.createChooser(shareIntent, "分享日志文件");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            context.startActivity(chooser);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
            Log.i(TAG, "已打开分享日志文件: " + logFile.getAbsolutePath());
            
        } catch (Exception e) {
            Log.e(TAG, "分享日志文件失败", e);
            call.reject("分享日志文件失败: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        // 停止日志收集
        isLogging = false;
        if (logThread != null) {
            logThread.interrupt();
        }
        super.handleOnDestroy();
    }
}
