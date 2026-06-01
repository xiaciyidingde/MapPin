import { registerPlugin } from '@capacitor/core';

export interface RTCMAnalyzerPlugin {
  analyzeLatestFile(): Promise<{
    fileName: string;
    fileSize: number;
    lastModified: number;
    messages: Record<string, number>;
    totalMessages: number;
    hasEphemeris: boolean;
  }>;
}

const RTCMAnalyzer = registerPlugin<RTCMAnalyzerPlugin>('RTCMAnalyzer', {
  web: () => import('./rtcmAnalyzer.web').then(m => new m.RTCMAnalyzerWeb()),
});

export default RTCMAnalyzer;
