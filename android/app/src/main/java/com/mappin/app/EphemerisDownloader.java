package com.mappin.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.apache.commons.compress.compressors.z.ZCompressorInputStream;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 星历数据下载器
 *
 * 策略（按优先级）：
 *  1. CAS Ultra-rapid SP3 精密星历（小时级实时，最新）
 *     https://data.bdsmart.cn/pub/product/ultrarapid/{GPSW}/CAS0MGXULT_{YYYY}{DOY}{HH}00_01H_05M_ORB.SP3.gz
 *  2. BRDC 广播星历（CAS / WHU / BKG，作为 SP3 失败时的备份）
 *
 * SP3 提供米级精度卫星轨道，对 SPP 单点定位足够；同时 RTKLIB 会优先使用精密星历。
 */
public class EphemerisDownloader {
    private static final String TAG = "EphemerisDownloader";

    /** GPS 历元起点（1980-01-06 UTC）的毫秒数 */
    private static final long GPS_EPOCH_MS = 315964800000L;

    /** CAS Ultra-rapid SP3 模板，每小时更新一次 */
    private static final String CAS_SP3_TEMPLATE =
        "https://data.bdsmart.cn/pub/product/ultrarapid/%GPSW%/CAS0MGXULT_%YEAR%%DOY%%HH%00_01H_05M_ORB.SP3.gz";

    /** WHU MGEX Ultra-rapid SP3 模板（FTP，按 GPS 周组织目录） */
    private static final String WHU_SP3_TEMPLATE =
        "ftp://igs.gnsswhu.cn/pub/gps/products/mgex/%GPSW%/WUM0MGXULA_%YEAR%%DOY%%HH%00_01D_05M_ORB.SP3.gz";

    /** WHU MGEX Rapid SP3 模板（每日产品，作为 Ultra-rapid 失败时的兜底 SP3） */
    private static final String WHU_RAPID_SP3_TEMPLATE =
        "ftp://igs.gnsswhu.cn/pub/gps/products/mgex/%GPSW%/WUM0MGXRAP_%YEAR%%DOY%0000_01D_05M_ORB.SP3.gz";

    /** BRDC 广播星历备份服务器（SP3 全部失败后的兜底） */
    private static final String[] BRDC_SERVERS = {
        // 中国科学院 - CAS 合并星历（RINEX 3 格式）
        "https://data.bdsmart.cn/pub/product/rts/brdc/%YEAR%/%DOY%/BRDM00CAS_S_%YEAR%%DOY%0000_01D_MN.rnx.gz",
        // 武汉大学（国内，FTP）
        "ftp://igs.gnsswhu.cn/pub/gps/data/daily/%YEAR%/%DOY%/%YY%n/brdc%DOY%0.%YY%n.gz",
        // 德国 BKG（RINEX 3 格式）
        "https://igs.bkg.bund.de/root_ftp/IGS/BRDC/%YEAR%/%DOY%/BRDC00WRD_R_%YEAR%%DOY%0000_01D_MN.rnx.gz",
    };

    /** SP3 最多往前回退多少小时（避免最新文件还没生成） */
    private static final int MAX_HOUR_BACK = 6;

    /** BRDC 最多往前回退多少天 */
    private static final int MAX_DAYS_BACK = 1;

    private ExecutorService executor = Executors.newSingleThreadExecutor();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private RTKLibWrapper rtkLibWrapper;
    private Context context;

    public EphemerisDownloader(Context context, RTKLibWrapper rtkLibWrapper) {
        this.context = context;
        this.rtkLibWrapper = rtkLibWrapper;
    }

    /**
     * 下载星历（串行：BRDC 优先 + SP3 补充）
     *
     * 顺序：
     *   1. BRDC 广播星历（必需，做 SPP 的基础）
     *   2. SP3 精密星历（可选，提升 DGPS/Static 精度）
     *
     * 任一成功即视为完成，两者都失败才报错。
     */
    public void downloadTodayEphemeris(DownloadCallback callback) {
        executor.execute(() -> {
            Log.i(TAG, "========================================");
            Log.i(TAG, "开始下载星历数据（串行：BRDC 优先 + SP3 补充）");
            Log.i(TAG, "========================================");

            int totalLoaded = 0;
            StringBuilder summary = new StringBuilder();

            // 步骤 1：BRDC 广播星历（必需，做 SPP）
            try {
                int brdcCount = tryDownloadBrdcRinex();
                if (brdcCount > 0) {
                    totalLoaded += brdcCount;
                    summary.append("BRDC=").append(brdcCount).append(" ");
                    Log.i(TAG, "[1/2] BRDC 广播星历加载成功: " + brdcCount + " 条");
                } else {
                    Log.w(TAG, "[1/2] BRDC 下载返回 0 条，继续尝试 SP3");
                }
            } catch (Exception e) {
                Log.w(TAG, "[1/2] BRDC 下载失败: " + e.getMessage() + "，继续尝试 SP3");
            }

            // 步骤 2：SP3 精密星历（可选，失败不阻塞整体）
            int sp3Count = 0;
            sp3Count = tryDownloadSp3(CAS_SP3_TEMPLATE, "CAS Ultra-rapid SP3", true);
            if (sp3Count == 0) {
                sp3Count = tryDownloadSp3(WHU_SP3_TEMPLATE, "WHU MGEX Ultra-rapid SP3", true);
            }
            if (sp3Count == 0) {
                sp3Count = tryDownloadSp3(WHU_RAPID_SP3_TEMPLATE, "WHU MGEX Rapid SP3", false);
            }
            if (sp3Count > 0) {
                totalLoaded += sp3Count;
                summary.append("SP3=").append(sp3Count);
                Log.i(TAG, "[2/2] SP3 精密星历加载成功: " + sp3Count + " 条");
            } else {
                Log.w(TAG, "[2/2] 所有 SP3 源失败，仅使用 BRDC");
            }

            // 至少有一个成功就算完成
            if (totalLoaded > 0) {
                final int n = totalLoaded;
                final String s = summary.toString().trim();
                Log.i(TAG, "========================================");
                Log.i(TAG, "星历加载完成: " + s + "（共 " + n + " 条）");
                Log.i(TAG, "========================================");
                mainHandler.post(() -> callback.onSuccess(n));
            } else {
                Log.e(TAG, "========================================");
                Log.e(TAG, "星历下载失败：BRDC 和 SP3 都不可用");
                Log.e(TAG, "========================================");
                mainHandler.post(() -> callback.onError("BRDC 和 SP3 都下载失败"));
            }
        });
    }

    /**
     * 尝试从指定模板下载 SP3 文件
     *
     * @param urlTemplate 含 %GPSW% / %YEAR% / %DOY% / %HH% 占位符的 URL 模板
     * @param sourceName 日志中显示的源名称
     * @param hourly 是否按小时回退（true = Ultra-rapid，false = 每日 Rapid）
     * @return 加载到 RTKLIB 的精密星历记录数（0 表示全部失败）
     */
    private int tryDownloadSp3(String urlTemplate, String sourceName, boolean hourly) {
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        int maxBack = hourly ? MAX_HOUR_BACK : MAX_DAYS_BACK;

        for (int back = 0; back <= maxBack; back++) {
            Calendar target = (Calendar) cal.clone();
            if (hourly) {
                target.add(Calendar.HOUR_OF_DAY, -back);
            } else {
                target.add(Calendar.DAY_OF_YEAR, -back);
            }

            int year = target.get(Calendar.YEAR);
            int doy = target.get(Calendar.DAY_OF_YEAR);
            int hh = target.get(Calendar.HOUR_OF_DAY);
            int gpsw = computeGpsWeek(target.getTimeInMillis());

            String url = urlTemplate
                .replace("%GPSW%", String.valueOf(gpsw))
                .replace("%YEAR%", String.valueOf(year))
                .replace("%DOY%", String.format("%03d", doy))
                .replace("%HH%", String.format("%02d", hh));

            String backDesc;
            if (back == 0) {
                backDesc = hourly ? "当前小时" : "当天";
            } else {
                backDesc = hourly ? ("往前 " + back + " 小时") : ("往前 " + back + " 天");
            }
            Log.i(TAG, "[" + sourceName + "] " + backDesc
                + " (GPSW=" + gpsw + ", DOY=" + doy + (hourly ? ", HH=" + hh : "") + ")");
            Log.i(TAG, "  URL: " + url);

            try {
                long start = System.currentTimeMillis();
                byte[] data;
                if (url.startsWith("https://") || url.startsWith("http://")) {
                    data = downloadFileHTTPS(url);
                } else if (url.startsWith("ftp://")) {
                    data = downloadFileFTP(url);
                } else {
                    Log.w(TAG, "  不支持的协议: " + url);
                    continue;
                }
                long elapsed = System.currentTimeMillis() - start;

                if (data == null || data.length == 0) {
                    Log.w(TAG, "  返回数据为空");
                    continue;
                }

                Log.i(TAG, "  下载成功: " + formatBytes(data.length) + ", 耗时 " + elapsed + " ms");

                // SP3 文件以 .gz 压缩
                int originalSize = data.length;
                data = decompressGzip(data);
                Log.i(TAG, "  解压: " + formatBytes(originalSize) + " -> " + formatBytes(data.length));

                // 保存 SP3 文件副本（用于离线调试）
                try {
                    String fileName = url.substring(url.lastIndexOf('/') + 1);
                    if (fileName.endsWith(".gz")) {
                        fileName = fileName.substring(0, fileName.length() - 3);
                    }
                    java.io.File ephDir = new java.io.File(context.getFilesDir(), "ephemeris");
                    if (!ephDir.exists()) {
                        ephDir.mkdirs();
                    }
                    java.io.File sp3File = new java.io.File(ephDir, fileName);
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(sp3File);
                    fos.write(data);
                    fos.close();
                    Log.i(TAG, "  SP3 文件已保存: " + sp3File.getAbsolutePath());
                } catch (Exception e) {
                    Log.w(TAG, "  保存 SP3 文件失败: " + e.getMessage());
                }

                int loaded = rtkLibWrapper.loadSp3(data, data.length);
                if (loaded > 0) {
                    Log.i(TAG, "  RTKLIB 加载 SP3 成功: " + loaded + " 条精密星历记录");
                    return loaded;
                }

                Log.w(TAG, "  RTKLIB 加载 SP3 失败");
            } catch (Exception e) {
                Log.w(TAG, "  下载/加载失败: " + e.getMessage());
            }
        }

        return 0;
    }

    /**
     * 兜底：BRDC RINEX 广播星历下载（保留原有多源逻辑）
     * @return 加载成功的星历数量（0 表示失败）
     * @throws Exception 全部源失败时抛出
     */
    private int tryDownloadBrdcRinex() throws Exception {
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        int year = cal.get(Calendar.YEAR);
        int doy = cal.get(Calendar.DAY_OF_YEAR);

        Log.i(TAG, "BRDC: 目标日期 " + year + " 第 " + doy + " 天");

        byte[] ephemerisData = null;
        String successUrl = null;

        for (int s = 0; s < BRDC_SERVERS.length && ephemerisData == null; s++) {
            String tpl = BRDC_SERVERS[s];
            Log.i(TAG, "[BRDC " + (s + 1) + "/" + BRDC_SERVERS.length + "] " + getServerName(tpl));

            for (int back = 0; back <= MAX_DAYS_BACK; back++) {
                Calendar target = (Calendar) cal.clone();
                target.add(Calendar.DAY_OF_YEAR, -back);
                int ty = target.get(Calendar.YEAR);
                int td = target.get(Calendar.DAY_OF_YEAR);
                String tyy = String.format("%02d", ty % 100);

                String url = tpl
                    .replace("%YEAR%", String.valueOf(ty))
                    .replace("%DOY%", String.format("%03d", td))
                    .replace("%YY%", tyy);

                Log.i(TAG, "  尝试 " + (back == 0 ? "当天" : "往前 " + back + " 天") + " (DOY " + td + ")");
                Log.i(TAG, "  URL: " + url);

                try {
                    byte[] data;
                    if (url.startsWith("https://")) {
                        data = downloadFileHTTPS(url);
                    } else if (url.startsWith("ftp://")) {
                        data = downloadFileFTP(url);
                    } else {
                        Log.w(TAG, "  不支持的协议: " + url);
                        continue;
                    }

                    if (data != null && data.length > 0) {
                        ephemerisData = data;
                        successUrl = url;
                        Log.i(TAG, "  下载成功: " + formatBytes(data.length));
                        break;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "  失败: " + e.getMessage());
                }
            }
        }

        if (ephemerisData == null) {
            throw new Exception("所有 BRDC 源下载失败");
        }

        // 解压
        if (successUrl.endsWith(".gz")) {
            int originalSize = ephemerisData.length;
            ephemerisData = decompressGzip(ephemerisData);
            Log.i(TAG, "GZIP 解压: " + formatBytes(originalSize) + " -> " + formatBytes(ephemerisData.length));
        } else if (successUrl.endsWith(".Z")) {
            int originalSize = ephemerisData.length;
            ephemerisData = decompressUnixCompress(ephemerisData);
            Log.i(TAG, "Unix Compress 解压: " + formatBytes(originalSize) + " -> " + formatBytes(ephemerisData.length));
        }

        // 保存 BRDC 文件副本（用于离线调试）
        try {
            String fileName = successUrl.substring(successUrl.lastIndexOf('/') + 1);
            if (fileName.endsWith(".gz")) {
                fileName = fileName.substring(0, fileName.length() - 3);
            } else if (fileName.endsWith(".Z")) {
                fileName = fileName.substring(0, fileName.length() - 2);
            }
            java.io.File ephDir = new java.io.File(context.getFilesDir(), "ephemeris");
            if (!ephDir.exists()) {
                ephDir.mkdirs();
            }
            java.io.File navFile = new java.io.File(ephDir, fileName);
            java.io.FileOutputStream fos = new java.io.FileOutputStream(navFile);
            fos.write(ephemerisData);
            fos.close();
            Log.i(TAG, "BRDC 文件已保存: " + navFile.getAbsolutePath());
        } catch (Exception e) {
            Log.w(TAG, "保存 BRDC 文件失败: " + e.getMessage());
        }

        return rtkLibWrapper.loadRinexNav(ephemerisData, ephemerisData.length);
    }

    /**
     * 计算 GPS 周（自 1980-01-06 UTC 起）
     */
    private int computeGpsWeek(long timeMs) {
        long deltaMs = timeMs - GPS_EPOCH_MS;
        return (int) (deltaMs / (7L * 86_400_000L));
    }

    /**
     * 通过 FTP 下载文件
     */
    private byte[] downloadFileFTP(String urlString) throws Exception {
        URL url = new URL(urlString);
        InputStream in = url.openStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = in.read(buffer)) != -1) {
            out.write(buffer, 0, bytesRead);
        }
        in.close();
        return out.toByteArray();
    }

    /**
     * 通过 HTTPS 下载文件
     */
    private byte[] downloadFileHTTPS(String urlString) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(40000);
        connection.setRequestProperty("User-Agent", "MapPin/1.3.6");
        connection.setInstanceFollowRedirects(true);

        try {
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new Exception("HTTP " + responseCode);
            }

            InputStream in = new BufferedInputStream(connection.getInputStream());
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            in.close();
            return out.toByteArray();
        } finally {
            connection.disconnect();
        }
    }

    /**
     * 解压 GZIP 数据
     */
    private byte[] decompressGzip(byte[] compressed) throws Exception {
        java.io.ByteArrayInputStream bis = new java.io.ByteArrayInputStream(compressed);
        java.util.zip.GZIPInputStream gis = new java.util.zip.GZIPInputStream(bis);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = gis.read(buffer)) != -1) {
            out.write(buffer, 0, bytesRead);
        }
        gis.close();
        return out.toByteArray();
    }

    /**
     * 解压 Unix Compress (.Z) 数据
     * 使用 Apache Commons Compress
     */
    private byte[] decompressUnixCompress(byte[] compressed) throws Exception {
        try {
            ByteArrayInputStream bis = new ByteArrayInputStream(compressed);
            ZCompressorInputStream zis = new ZCompressorInputStream(bis);
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = zis.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            
            zis.close();
            return out.toByteArray();
        } catch (Exception e) {
            Log.w(TAG, "Unix Compress 解压失败: " + e.getMessage());
            return compressed;
        }
    }

    /**
     * 获取服务器名称（从 URL 提取）
     */
    private String getServerName(String url) {
        try {
            if (url.contains("bdsmart.cn") && url.contains("ultrarapid")) return "中国科学院 CAS Ultra-rapid SP3";
            if (url.contains("bdsmart.cn")) return "中国科学院 CAS BRDC";
            if (url.contains("gnsswhu.cn")) return "武汉大学 WHU";
            if (url.contains("bkg.bund.de")) return "德国 BKG";
            return url.split("/")[2];
        } catch (Exception e) {
            return "未知服务器";
        }
    }

    /**
     * 格式化字节数
     */
    private String formatBytes(int bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
        return String.format("%.2f MB", bytes / (1024.0 * 1024.0));
    }

    /**
     * 下载回调接口
     */
    public interface DownloadCallback {
        void onSuccess(int ephemerisCount);
        void onError(String error);
    }

    /**
     * 释放资源
     */
    public void destroy() {
        if (executor != null) {
            executor.shutdown();
        }
    }
}
