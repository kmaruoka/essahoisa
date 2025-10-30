import { useState, useEffect } from 'react';
import type { ScheduleFile, MonitorConfig, AppConfig } from '../types';
import { cleanupOldRecords, clearPlaybackRecords } from '../utils/audioPlaybackManager';
import { logger } from '../utils/logger';
import { useScheduleData } from './useScheduleData';
import { useAudioQueue } from './useAudioQueue';
import { fetchAppConfig } from '../services/configService';


// 統合処理はフックとサービスへ委譲

// メモリ使用量監視
const logMemoryUsage = () => {
  if (process.env.NODE_ENV !== 'production' && 'memory' in performance) {
    const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    logger.debug('メモリ使用量:', {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    });
  }
};

// ポーリング管理
class PollingManager {
  private static instance: PollingManager;
  private pollingStates = new Map<string, {
    isRunning: boolean;
    timeoutId: number | null;
    callbacks: Set<() => void>;
  }>();

  static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }

  isRunning(monitorKey: string): boolean {
    return this.pollingStates.has(monitorKey) && this.pollingStates.get(monitorKey)!.isRunning;
  }

  startPolling(monitorKey: string, callback: () => void): () => void {
    if (this.isRunning(monitorKey)) {
      logger.debug(`モニター ${monitorKey} のポーリングは既に実行中です`);
      const state = this.pollingStates.get(monitorKey)!;
      state.callbacks.add(callback);
      return () => {
        state.callbacks.delete(callback);
        if (state.callbacks.size === 0) {
          this.stopPolling(monitorKey);
        }
      };
    }

    logger.debug(`ポーリング開始: モニター ${monitorKey}`);
    this.pollingStates.set(monitorKey, {
      isRunning: true,
      timeoutId: null,
      callbacks: new Set([callback])
    });

    return () => {
      this.stopPolling(monitorKey);
    };
  }

  private stopPolling(monitorKey: string): void {
    const state = this.pollingStates.get(monitorKey);
    if (state) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      this.pollingStates.delete(monitorKey);
      logger.debug(`ポーリング停止: モニター ${monitorKey}`);
    }
  }

  setTimeout(monitorKey: string, callback: () => void, delay: number): void {
    const state = this.pollingStates.get(monitorKey);
    if (state && state.isRunning) {
      const timeoutId = window.setTimeout(callback, delay);
      state.timeoutId = timeoutId;
    }
  }
}

const pollingManager = PollingManager.getInstance();

// ポーリングフック（setTimeoutの連鎖）
export const usePolling = (monitor: MonitorConfig, appConfig: AppConfig, isVisible: boolean = true, isLeftSide?: boolean) => {
  const [data, setData] = useState<ScheduleFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(appConfig);
  const [currentMonitor, setCurrentMonitor] = useState<MonitorConfig>(monitor);
  const [displayEntries, setDisplayEntries] = useState<ScheduleFile['entries']>([]);
  const { load } = useScheduleData();
  const { enqueueForDisplay } = useAudioQueue();
  
  const monitorKey = monitor.id;

  const startPolling = () => {
    const scheduleNext = async () => {
      if (!pollingManager.isRunning(monitorKey)) return;
      
      let nextIntervalMs = 10000;
      try {
        // メモリ使用量をログ出力
        logMemoryUsage();
        const { latestConfig, selectedMonitor, data: newData, displayEntries: newDisplayEntries, currentTimeMinutes } = await load(monitor.id);
        // 設定未取得・モニター未発見・データ未取得のいずれでも、次回ポーリングは継続する
        if (!latestConfig) {
          setError('設定ファイルの取得に失敗しました');
          setLoading(false);
          setDisplayEntries([]);
        } else if (!selectedMonitor) {
          setError('指定されたモニター設定が見つかりません');
          setLoading(false);
          setDisplayEntries([]);
          if (typeof latestConfig.pollingIntervalSeconds === 'number' && latestConfig.pollingIntervalSeconds > 0) {
            nextIntervalMs = latestConfig.pollingIntervalSeconds * 1000;
          }
        } else if (!newData) {
          logger.error('データ取得失敗');
          setError('データの取得に失敗しました');
          setLoading(false);
          if (typeof latestConfig.pollingIntervalSeconds === 'number' && latestConfig.pollingIntervalSeconds > 0) {
            nextIntervalMs = latestConfig.pollingIntervalSeconds * 1000;
          }
        } else {
          const effectiveConfig = latestConfig;
          setCurrentMonitor(selectedMonitor);
          setCurrentConfig(latestConfig);
          setData(newData);
          setDisplayEntries(newDisplayEntries);
          setError(null);
          setLoading(false);
          enqueueForDisplay(newDisplayEntries, selectedMonitor, effectiveConfig, currentTimeMinutes, isVisible, isLeftSide);
          if (typeof latestConfig.pollingIntervalSeconds === 'number' && latestConfig.pollingIntervalSeconds > 0) {
            nextIntervalMs = latestConfig.pollingIntervalSeconds * 1000;
          }
        }
      } catch (error) {
        logger.error('ポーリングエラー:', error);
      }
      
      if (pollingManager.isRunning(monitorKey)) {
        pollingManager.setTimeout(monitorKey, scheduleNext, nextIntervalMs);
      }
    };

    // 非同期でローカルストレージの初期化処理を実行（ポーリングをブロックしない）
    setTimeout(() => {
      try {
        // 古い記録をクリーンアップ
        cleanupOldRecords();
        
        // 壊れたデータを修復（ローカルストレージをクリア）
        const records = JSON.parse(localStorage.getItem('audioPlaybackRecords') || '[]');
        const hasCorruptedData = records.some((record: { entryId?: string; timingMinutes?: number }) => 
          !record.entryId || typeof record.entryId !== 'string' || 
          record.timingMinutes === null || typeof record.timingMinutes !== 'number'
        );
        
        if (hasCorruptedData) {
          logger.warn('壊れたデータを検出、ローカルストレージをクリア');
          clearPlaybackRecords();
        }
      } catch {
        logger.warn('ローカルストレージデータが壊れています、クリアします');
        clearPlaybackRecords();
      }
    }, 0);

    // ポーリングマネージャーを使用してポーリングを開始
    const cleanup = pollingManager.startPolling(monitorKey, scheduleNext);
    
    // 初回実行
    scheduleNext();
    
    return cleanup;
  };

  return { startPolling, data, loading, error, currentConfig, currentMonitor, displayEntries };
};

// 設定取得専用フック
export const useConfig = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialConfig = async () => {
      try {
        const initialConfig = await fetchAppConfig();
        if (initialConfig) {
          setConfig(initialConfig);
        } else {
          setError('設定ファイルの取得に失敗しました');
        }
      } catch (err) {
        console.error('設定ファイル取得エラー:', err);
        setError(err instanceof Error ? err.message : '設定ファイルの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialConfig();
  }, []);

  return { config, loading, error };
};
