import type { RTCMAnalyzerPlugin } from './rtcmAnalyzer';

export class RTCMAnalyzerWeb implements RTCMAnalyzerPlugin {
  async analyzeLatestFile(): Promise<{
    fileName: string;
    fileSize: number;
    lastModified: number;
    messages: Record<string, number>;
    totalMessages: number;
    hasEphemeris: boolean;
  }> {
    throw new Error('RTCM分析功能仅在Android平台可用');
  }
}
