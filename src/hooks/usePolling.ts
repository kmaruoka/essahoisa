import { useState, useEffect } from 'react';
import type { ScheduleFile, MonitorConfig, AppConfig } from '../types';
import { cleanupOldRecords, clearPlaybackRecords } from '../utils/audioPlaybackManager';
import { logger } from '../utils/logger';
import { useScheduleData } from './useScheduleData';
import { useAudioQueue } from './useAudioQueue';
import { fetchAppConfig } from '../services/configService';


// 統合処理はフックとサービスへ委譲

// メモリ使用量監視: 危険閾値を超えたときのみ WARN を出力（スパム防止で一定間隔に抑制）
let lastMemoryWarnAt = 0;
const logMemoryUsage = () => {
  if (!('memory' in performance)) return;
  const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const usedMb = Math.round(memory.usedJSHeapSize / 1024 / 1024);
  const limitMb = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
  const usageRatio = memory.usedJSHeapSize / Math.max(1, memory.jsHeapSizeLimit);

  // 危険水準（80%）を超えたら WARN。連続警告は30秒に1回まで。
  const DANGER_THRESHOLD = 0.8;
  const WARN_INTERVAL_MS = 30_000;
  const now = Date.now();

  if (usageRatio >= DANGER_THRESHOLD) {
    if (now - lastMemoryWarnAt >= WARN_INTERVAL_MS) {
      lastMemoryWarnAt = now;
      logger.warn('メモリ使用量が高水準です', {
        used: `${usedMb}MB`,
        limit: `${limitMb}MB`,
        usagePercent: Math.round(usageRatio * 100) + '%'
      });
    }
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

        // 正常系のみ値を反映（Fail Fast。throw されない限り正常）
        setCurrentMonitor(selectedMonitor);
        setCurrentConfig(latestConfig);
        setData(newData);
        setDisplayEntries(newDisplayEntries);
        setError(null);
        setLoading(false);
        enqueueForDisplay(newDisplayEntries, selectedMonitor, latestConfig, currentTimeMinutes, isVisible, isLeftSide);

        if (typeof latestConfig.pollingIntervalSeconds === 'number' && latestConfig.pollingIntervalSeconds > 0) {
          nextIntervalMs = latestConfig.pollingIntervalSeconds * 1000;
        }
      } catch (error) {
        logger.error('ポーリングエラー:', error);
        setError(error instanceof Error ? error.message : 'ポーリング中にエラーが発生しました');
        setLoading(false);
        setDisplayEntries([]);
        // latestConfig が取れていない可能性があるため、nextIntervalMs はデフォルトのまま
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
