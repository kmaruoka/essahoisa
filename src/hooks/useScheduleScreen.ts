import { useEffect } from 'react';
import { usePolling } from './usePolling';
import type { AppConfig, MonitorConfig } from '../types';

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

interface UseScheduleScreenProps {
  monitor: MonitorConfig;
  appConfig: AppConfig;
  isVisible?: boolean;
  isLeftSide?: boolean; // 分割表示時の左右の位置（true=左、false=右、undefined=単一表示）
}

export const useScheduleScreen = ({ monitor, appConfig, isVisible = true, isLeftSide }: UseScheduleScreenProps) => {
  // ポーリングを使用（全てのロジックが統合されている）
  const { startPolling, loading, error, currentConfig, currentMonitor, displayEntries } = usePolling(monitor, appConfig, isVisible, isLeftSide);
  
  // 最新の設定を使用（ポーリングで更新された設定を優先）
  const effectiveConfig = currentConfig || appConfig;
  const effectiveMonitor = currentMonitor || monitor;

  // ポーリング開始
  useEffect(() => {
    const stopPolling = startPolling();
    return stopPolling;
  }, []); // 依存配列を空にして、初回のみ実行
  
  // 上段（先発）
  const primaryEntry = displayEntries[0];
  // 下段（次発）
  const secondaryEntry = displayEntries[1];

  // 音声API自動有効化（ユーザーインタラクション不要）
  useEffect(() => {
    if (effectiveMonitor.hasAudio && SPEECH_SUPPORTED) {
      // 無音の音声を再生してAPIを有効化
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      
      try {
        window.speechSynthesis.speak(silentUtterance);
      } catch {
        // 音声API自動有効化エラーは無視
      }
    }
  }, [effectiveMonitor.hasAudio]);

  return {
    loading,
    error,
    effectiveConfig,
    effectiveMonitor,
    primaryEntry,
    secondaryEntry,
    SPEECH_SUPPORTED
  };
};
