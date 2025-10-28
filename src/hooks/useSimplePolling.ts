import { useState } from 'react';
import type { ScheduleFile, MonitorConfig, AppConfig } from '../types';
import { 
  hasBeenPlayed, 
  cleanupOldRecords,
  clearPlaybackRecords
} from '../utils/audioPlaybackManager';
import { formatSpeech } from '../utils/formatSpeech';
import { addToGlobalAudioQueue, processGlobalAudioQueue } from '../utils/audioPlaybackState';
import { logger } from '../utils/logger';

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// 設定ファイルURL構築関数
const buildConfigUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'config/monitor-config.json';
  }
  const base = window.location.href.split(/[?#]/)[0];
  const lastSlash = base.lastIndexOf('/');
  const lastSegment = lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
  const hasExtension = lastSegment.includes('.');
  const normalized = hasExtension
    ? base.slice(0, lastSlash + 1)
    : base.endsWith('/') ? base : base + '/';

  return `${normalized}config/monitor-config.json`;
};




// データ取得関数
const fetchData = async (dataUrl: string): Promise<ScheduleFile | null> => {
  try {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`データの取得に失敗しました (${response.status})`);
    }
    const json = await response.json() as ScheduleFile;
    return json;
  } catch (err: unknown) {
    console.error('データ取得エラー:', err);
    return null;
  }
};

// 設定取得関数
const fetchConfig = async (): Promise<AppConfig | null> => {
  try {
    const configUrl = buildConfigUrl();
    const response = await fetch(configUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`設定ファイルの取得に失敗しました (${response.status})`);
    }
    const config = await response.json() as AppConfig;
    return config;
  } catch (err: unknown) {
    console.error('設定取得エラー:', err);
    return null;
  }
};

// 統合ポーリング処理（全てのロジックを含む）
const unifiedPolling = async (
  monitor: MonitorConfig, 
  appConfig: AppConfig, 
  setData: (data: ScheduleFile | null) => void, 
  setError: (error: string | null) => void, 
  setLoading: (loading: boolean) => void,
  setCurrentConfig: (config: AppConfig) => void,
  setCurrentMonitor: (monitor: MonitorConfig) => void,
  setDisplayEntries: (entries: ScheduleFile['entries']) => void,
  isVisible: boolean = true,
  isLeftSide?: boolean // 分割表示時の左右の位置（true=左、false=右、undefined=単一表示）
) => {
  logger.debug(`統合ポーリング実行: monitor=${monitor.title}, hasAudio=${monitor.hasAudio}, SPEECH_SUPPORTED=${SPEECH_SUPPORTED}, isVisible=${isVisible}`);
  
  // 1. 設定ファイル取得
  const latestConfig = await fetchConfig();
  if (!latestConfig) {
    logger.debug('設定ファイル取得失敗、既存設定を使用');
  } else {
    logger.debug('設定ファイル取得成功');
    const monitorConfig = latestConfig.monitors.find(m => m.id === monitor.id);
    if (monitorConfig?.audioSettings?.timings) {
      logger.debug(`現在のtimings設定: [${monitorConfig.audioSettings.timings.join(', ')}]`);
    }
    // 最新の設定を状態に反映
    setCurrentConfig(latestConfig);
    if (monitorConfig) {
      setCurrentMonitor(monitorConfig);
    }
  }
  const config = latestConfig || appConfig;
  
  // 2. データ取得
  const newData = await fetchData(monitor.dataUrl);
  if (!newData?.entries) {
    logger.error('データ取得失敗');
    setError('データの取得に失敗しました');
    setLoading(false);
    return;
  }
  logger.debug(`データ取得完了: エントリ数=${newData.entries.length}`);
  logger.debug(`データURL: ${monitor.dataUrl}`);
  logger.debug(`最新エントリ: ${newData.entries.slice(-3).map(e => `${e.supplierName}(${e.arrivalTime})`).join(', ')}`);
  
  // 3. 表示用エントリの処理（全てのロジックを統合）
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const beforeMinutes = config.displaySettings?.beforeMinutes ?? 30;
  
  // 現在時刻の詳細ログ
  logger.info(`現在時刻: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} (${currentTime}分)`);
  
  // エントリをソート
  const sortedEntries = [...newData.entries].sort((a, b) => {
    if (!a.arrivalTime || !b.arrivalTime) return 0;
    const [aHours, aMinutes] = a.arrivalTime.split(':').map(Number);
    const [bHours, bMinutes] = b.arrivalTime.split(':').map(Number);
    const aTime = aHours * 60 + aMinutes;
    const bTime = bHours * 60 + bMinutes;
    return aTime - bTime;
  });
  
  // 表示対象のエントリをフィルタリング
  const displayEntries = sortedEntries.filter(entry => {
    if (!entry.arrivalTime) return false;
    const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
    let arrivalTime = hours * 60 + minutes;
    
    // 日をまたぐ場合の処理（現在時刻より小さい場合は翌日とみなす）
    if (arrivalTime < currentTime) {
      arrivalTime += 24 * 60; // 24時間（1440分）を追加
    }
    
    const isAfterCurrentTime = arrivalTime >= currentTime;
    const timeDiff = arrivalTime - currentTime;
    const shouldShow = isAfterCurrentTime && timeDiff <= beforeMinutes;
    
    // デバッグログ追加
    logger.debug(`エントリフィルタリング: ${entry.supplierName} (${entry.arrivalTime}) - 到着時刻:${arrivalTime}分, 現在時刻:${currentTime}分, 時間差:${timeDiff}分, beforeMinutes:${beforeMinutes}, 表示対象:${shouldShow}`);
    
    return shouldShow;
  });
  
  // フィルタリング結果のサマリーログ
  logger.info(`フィルタリング結果: 全エントリ数=${sortedEntries.length}, 表示対象エントリ数=${displayEntries.length}, beforeMinutes=${beforeMinutes}`);
  if (displayEntries.length > 0) {
    logger.info(`表示対象エントリ: ${displayEntries.map(e => `${e.supplierName}(${e.arrivalTime})`).join(', ')}`);
  }

  // データを状態に保存
  setData(newData);
  setDisplayEntries(displayEntries);
  setError(null);
  setLoading(false);
  
  // 4. 音声チェック（音声が有効で表示されている場合のみ）
  logger.debug(`音声チェック条件: hasAudio=${monitor.hasAudio}, SPEECH_SUPPORTED=${SPEECH_SUPPORTED}, isVisible=${isVisible}, displayEntries.length=${displayEntries.length}`);
  if (monitor.hasAudio && SPEECH_SUPPORTED && isVisible) {
    // 最新の設定からtimingsを取得
    const monitorConfig = config.monitors.find(m => m.id === monitor.id);
    const audioSettings = monitorConfig?.audioSettings || monitor.audioSettings;
    const speechTimings = audioSettings?.timings ?? [0];
    
    logger.debug(`音声判定開始: speechTimings=[${speechTimings.join(', ')}], 対象エントリ数=${displayEntries.length}`);
    
    for (const entry of displayEntries) {
      if (!entry.id || !entry.arrivalTime) continue;

      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      const timeDiff = arrivalTime - currentTime;

      logger.debug(`音声判定: ${entry.id} (${entry.arrivalTime}), 時間差: ${timeDiff}分`);

      const pastTimings = speechTimings.filter(timingMinutes => {
        const speechTime = arrivalTime - timingMinutes;
        const shouldPlay = currentTime >= speechTime;
        const speechTimeFormatted = `${Math.floor(speechTime / 60).toString().padStart(2, '0')}:${(speechTime % 60).toString().padStart(2, '0')}`;
        const currentTimeFormatted = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
        logger.debug(`  タイミング${timingMinutes}分: 再生時刻${speechTimeFormatted}(${speechTime}分), 現在時刻${currentTimeFormatted}(${currentTime}分), 判定=${shouldPlay}`);
        return shouldPlay;
      });

      logger.debug(`  条件を満たすタイミング: [${pastTimings.join(', ')}]`);

      if (pastTimings.length === 0) {
        logger.debug(`  → 条件を満たすタイミングなし、スキップ`);
        continue;
      }

      // 複数のタイミングが条件を満たす場合、最小値（最も近いタイミング）を選択
      const sortedPastTimings = [...pastTimings].sort((a, b) => a - b);
      logger.debug(`  ソート後タイミング: [${sortedPastTimings.join(', ')}]`);

      let targetTiming = null;
      for (const timingMinutes of sortedPastTimings) {
        const hasPlayed = hasBeenPlayed(entry.id, timingMinutes);
        logger.debug(`    タイミング${timingMinutes}分: 再生済み=${hasPlayed}`);
        if (!hasPlayed) {
          targetTiming = timingMinutes;
          break;
        }
      }

      if (targetTiming !== null) {
        logger.debug(`  → 音声再生対象: タイミング${targetTiming}分`);
        // グローバル音声キューに追加
        const isMainEntry = displayEntries.indexOf(entry) === 0; // 最初のエントリは上段
        const speechText = formatSpeech(config.speechFormat, entry);
        
        addToGlobalAudioQueue({
          entryId: entry.id,
          supplierName: entry.supplierName,
          arrivalTime: entry.arrivalTime || '',
          monitorId: monitor.id,
          monitorTitle: monitor.title,
          isMainEntry,
          timing: targetTiming,
          speechText,
          speechLang: monitor.speechLang || 'ja-JP',
          isLeftSide // 分割表示時の左右の位置
        });
        
        // 非同期でグローバル音声キュー処理を実行
        setTimeout(() => {
          processGlobalAudioQueue().catch(error => {
            logger.error(`グローバル音声キュー処理エラー:`, error);
          });
        }, 0);
        // 連続再生のためbreakを削除
      } else {
        logger.debug(`  → 音声再生対象なし（全て再生済み）`);
      }
    }
  }
};

// メモリ使用量監視
const logMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    logger.debug('メモリ使用量:', {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    });
  }
};

// シングルトンポーリング管理
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

    logger.debug(`シンプルポーリング開始: モニター ${monitorKey}`);
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
      logger.debug(`シンプルポーリング停止: モニター ${monitorKey}`);
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

// シンプルポーリングフック（setTimeoutの連鎖）
export const useSimplePolling = (monitor: MonitorConfig, appConfig: AppConfig, isVisible: boolean = true, isLeftSide?: boolean) => {
  const [data, setData] = useState<ScheduleFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(appConfig);
  const [currentMonitor, setCurrentMonitor] = useState<MonitorConfig>(monitor);
  const [displayEntries, setDisplayEntries] = useState<ScheduleFile['entries']>([]);
  
  const monitorKey = monitor.id;

  const startPolling = () => {
    const scheduleNext = async () => {
      if (!pollingManager.isRunning(monitorKey)) return;
      
      const pollStartTime = new Date();
      logger.debug(`ポーリング実行開始: ${pollStartTime.getHours().toString().padStart(2, '0')}:${pollStartTime.getMinutes().toString().padStart(2, '0')}:${pollStartTime.getSeconds().toString().padStart(2, '0')}`);
      
      try {
        // メモリ使用量をログ出力
        logMemoryUsage();
        await unifiedPolling(monitor, appConfig, setData, setError, setLoading, setCurrentConfig, setCurrentMonitor, setDisplayEntries, isVisible, isLeftSide);
      } catch (error) {
        logger.error('ポーリングエラー:', error);
      }
      
      if (pollingManager.isRunning(monitorKey)) {
        pollingManager.setTimeout(monitorKey, scheduleNext, 10000);
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
