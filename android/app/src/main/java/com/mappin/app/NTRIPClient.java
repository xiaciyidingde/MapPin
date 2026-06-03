package com.mappin.app;

import android.content.Context;
import android.util.Base64;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * NTRIP client used internally by RTKPlugin.
 */
public class NTRIPClient {
    private static final String TAG = "NTRIPClient";
    private static final String NTRIP_VERSION = "Ntrip/2.0";
    private static final String USER_AGENT = "NTRIP MapPin/1.0";
    private static final int HEADER_LIMIT_BYTES = 16 * 1024;
    private static final int DEBUG_RTCM_LIMIT_BYTES = 1_500_000;

    private final Context context;

    private Socket socket;
    private InputStream inputStream;
    private OutputStream outputStream;
    private Thread receiveThread;

    private volatile String status = "disconnected";
    private volatile String statusMessage = "";
    private volatile long connectedTime = 0;
    private volatile boolean isRunning = false;
    private volatile RTCMDataListener dataListener;

    private FileOutputStream rtcmFileStream = null;
    private int rtcmBytesWritten = 0;

    public NTRIPClient(Context context) {
        this.context = context;
    }

    public synchronized boolean connect(String host, int port, String mountpoint, String username, String password) {
        closeConnectionResources();

        try {
            status = "connecting";
            statusMessage = "正在连接...";

            socket = new Socket(host, port);
            socket.setSoTimeout(30000);
            inputStream = socket.getInputStream();
            outputStream = socket.getOutputStream();

            String request = buildNTRIPRequest(host, mountpoint, username, password);
            outputStream.write(request.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();

            String responseHeader = readResponseHeader(inputStream);
            String firstLine = firstHeaderLine(responseHeader);
            if (firstLine == null || !firstLine.contains("200")) {
                status = "error";
                statusMessage = "连接被拒绝: " + firstLine;
                closeConnectionResources();
                return false;
            }

            boolean chunked = responseHeader.toLowerCase(Locale.US)
                .contains("transfer-encoding: chunked");

            status = "connected";
            statusMessage = "已连接";
            connectedTime = System.currentTimeMillis();
            isRunning = true;

            openDebugRTCMFile();
            startReceiveThread(chunked);

            Log.i(TAG, "NTRIP connected: " + host + ":" + port + "/" + mountpoint
                + ", chunked=" + chunked);
            return true;
        } catch (Exception e) {
            status = "error";
            statusMessage = "连接失败: " + e.getMessage();
            Log.e(TAG, "NTRIP connection failed", e);
            closeConnectionResources();
            return false;
        }
    }

    public synchronized void disconnect() {
        closeConnectionResources();
        status = "disconnected";
        statusMessage = "已断开";
        connectedTime = 0;
        Log.i(TAG, "NTRIP disconnected");
    }

    private String buildNTRIPRequest(String host, String mountpoint, String username, String password) {
        StringBuilder request = new StringBuilder();
        request.append("GET /").append(mountpoint).append(" HTTP/1.1\r\n");
        request.append("Host: ").append(host).append("\r\n");
        request.append("Ntrip-Version: ").append(NTRIP_VERSION).append("\r\n");
        request.append("User-Agent: ").append(USER_AGENT).append("\r\n");

        String credentials = username + ":" + password;
        String encodedCredentials = Base64.encodeToString(
            credentials.getBytes(StandardCharsets.UTF_8),
            Base64.NO_WRAP
        );
        request.append("Authorization: Basic ").append(encodedCredentials).append("\r\n");
        request.append("\r\n");
        return request.toString();
    }

    private String readResponseHeader(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int matched = 0;
        byte[] end = new byte[] { '\r', '\n', '\r', '\n' };

        while (true) {
            int value = in.read();
            if (value == -1) {
                throw new IOException("NTRIP response ended before headers completed");
            }

            out.write(value);
            if (value == end[matched]) {
                matched++;
                if (matched == end.length) {
                    break;
                }
            } else {
                matched = value == end[0] ? 1 : 0;
            }

            if (out.size() > HEADER_LIMIT_BYTES) {
                throw new IOException("NTRIP response header is too large");
            }
        }

        return out.toString(StandardCharsets.ISO_8859_1.name());
    }

    private String firstHeaderLine(String header) {
        if (header == null || header.isEmpty()) {
            return null;
        }
        int index = header.indexOf('\n');
        String line = index >= 0 ? header.substring(0, index) : header;
        return line.replace("\r", "").trim();
    }

    private void startReceiveThread(boolean chunked) {
        receiveThread = new Thread(() -> {
            int totalBytesReceived = 0;
            byte[] buffer = new byte[4096];
            Log.i(TAG, "RTCM receive thread started, chunked=" + chunked);

            try {
                if (chunked) {
                    totalBytesReceived = receiveChunked(buffer, totalBytesReceived);
                } else {
                    totalBytesReceived = receiveRaw(buffer, totalBytesReceived);
                }
            } catch (IOException e) {
                if (isRunning) {
                    Log.e(TAG, "RTCM receive failed", e);
                    status = "error";
                    statusMessage = "接收数据失败: " + e.getMessage();
                }
            } finally {
                Log.i(TAG, "RTCM receive thread ended, total=" + totalBytesReceived + " bytes");
                if (isRunning) {
                    disconnect();
                }
            }
        }, "NTRIP-Receive");
        receiveThread.start();
    }

    private int receiveRaw(byte[] buffer, int totalBytesReceived) throws IOException {
        int bytesRead;
        while (isRunning && !Thread.currentThread().isInterrupted()) {
            bytesRead = inputStream.read(buffer);
            if (bytesRead == -1) {
                break;
            }
            if (bytesRead > 0) {
                totalBytesReceived += bytesRead;
                dispatchRTCMData(buffer, bytesRead, totalBytesReceived);
            }
        }
        return totalBytesReceived;
    }

    private int receiveChunked(byte[] buffer, int totalBytesReceived) throws IOException {
        while (isRunning && !Thread.currentThread().isInterrupted()) {
            String sizeLine = readAsciiLine(inputStream);
            if (sizeLine == null) {
                break;
            }
            if (sizeLine.isEmpty()) {
                continue;
            }

            int semicolon = sizeLine.indexOf(';');
            String sizeText = (semicolon >= 0 ? sizeLine.substring(0, semicolon) : sizeLine).trim();
            int chunkSize;
            try {
                chunkSize = Integer.parseInt(sizeText, 16);
            } catch (NumberFormatException e) {
                throw new IOException("Invalid chunk size: " + sizeLine, e);
            }
            if (chunkSize == 0) {
                drainChunkTrailers();
                break;
            }

            int remaining = chunkSize;
            while (remaining > 0 && isRunning && !Thread.currentThread().isInterrupted()) {
                int read = inputStream.read(buffer, 0, Math.min(buffer.length, remaining));
                if (read == -1) {
                    throw new IOException("Chunk ended unexpectedly");
                }
                remaining -= read;
                totalBytesReceived += read;
                dispatchRTCMData(buffer, read, totalBytesReceived);
            }

            consumeChunkTerminator(inputStream);
        }
        return totalBytesReceived;
    }

    private String readAsciiLine(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while (true) {
            int value = in.read();
            if (value == -1) {
                return out.size() == 0 ? null : out.toString(StandardCharsets.US_ASCII.name());
            }
            if (value == '\n') {
                break;
            }
            if (value != '\r') {
                out.write(value);
            }
            if (out.size() > 128) {
                throw new IOException("Chunk header is too large");
            }
        }
        return out.toString(StandardCharsets.US_ASCII.name()).trim();
    }

    private void consumeChunkTerminator(InputStream in) throws IOException {
        int first = in.read();
        if (first == '\r') {
            int second = in.read();
            if (second != '\n') {
                throw new IOException("Invalid chunk terminator");
            }
        } else if (first != '\n') {
            throw new IOException("Invalid chunk terminator");
        }
    }

    private void drainChunkTrailers() throws IOException {
        String line;
        do {
            line = readAsciiLine(inputStream);
        } while (line != null && !line.isEmpty());
    }

    private void dispatchRTCMData(byte[] buffer, int bytesRead, int totalBytesReceived) {
        Log.d(TAG, "Received RTCM data: " + bytesRead + " bytes (total=" + totalBytesReceived + ")");
        writeDebugRTCM(buffer, bytesRead);

        RTCMDataListener listener = dataListener;
        if (listener == null) {
            Log.w(TAG, "RTCM data listener is null");
            return;
        }

        byte[] data = new byte[bytesRead];
        System.arraycopy(buffer, 0, data, 0, bytesRead);
        listener.onRTCMData(data);
    }

    private void openDebugRTCMFile() {
        try {
            String fileName = "rtcm_" + System.currentTimeMillis() + ".bin";
            File file = new File(context.getExternalFilesDir(null), fileName);
            rtcmFileStream = new FileOutputStream(file);
            rtcmBytesWritten = 0;
            Log.i(TAG, "Saving RTCM debug data to " + file.getAbsolutePath());
        } catch (Exception e) {
            Log.w(TAG, "Unable to create RTCM debug file", e);
        }
    }

    private void writeDebugRTCM(byte[] buffer, int bytesRead) {
        if (rtcmFileStream == null || rtcmBytesWritten >= DEBUG_RTCM_LIMIT_BYTES) {
            return;
        }

        try {
            rtcmFileStream.write(buffer, 0, bytesRead);
            rtcmBytesWritten += bytesRead;
            if (rtcmBytesWritten >= DEBUG_RTCM_LIMIT_BYTES) {
                rtcmFileStream.close();
                rtcmFileStream = null;
                Log.i(TAG, "RTCM debug data saved: " + rtcmBytesWritten + " bytes");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to save RTCM debug data", e);
        }
    }

    private synchronized void closeConnectionResources() {
        isRunning = false;

        if (receiveThread != null) {
            if (receiveThread != Thread.currentThread()) {
                receiveThread.interrupt();
            }
            receiveThread = null;
        }

        closeDebugRTCMFile();
        closeQuietly(outputStream);
        closeQuietly(inputStream);
        closeQuietly(socket);
        outputStream = null;
        inputStream = null;
        socket = null;
    }

    private void closeDebugRTCMFile() {
        if (rtcmFileStream != null) {
            try {
                rtcmFileStream.close();
                Log.i(TAG, "RTCM debug file closed: " + rtcmBytesWritten + " bytes");
            } catch (Exception e) {
                Log.w(TAG, "Failed to close RTCM debug file", e);
            }
            rtcmFileStream = null;
        }
    }

    private void closeQuietly(java.io.Closeable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (IOException e) {
            Log.w(TAG, "Close failed", e);
        }
    }

    public void setDataListener(RTCMDataListener listener) {
        this.dataListener = listener;
    }

    public boolean isConnected() {
        return "connected".equals(status);
    }

    public String getStatus() {
        return status;
    }

    public String getStatusMessage() {
        return statusMessage;
    }

    public long getConnectedTime() {
        return connectedTime;
    }

    public interface RTCMDataListener {
        void onRTCMData(byte[] data);
    }
}
