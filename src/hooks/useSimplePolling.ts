import { useState } from 'react';
import type { ScheduleFile, MonitorConfig, AppConfig, ScheduleEntry } from '../types';
import { 
  savePlaybackRecord, 
  hasBeenPlayed, 
  cleanupOldRecords,
  clearPlaybackRecords
} from '../utils/audioPlaybackManager';
import { formatSpeech } from '../utils/formatSpeech';
import { startPlayback, endPlayback, isEntryAlreadyPlayed, addToGlobalAudioQueue, processGlobalAudioQueue } from '../utils/audioPlaybackState';

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

// MP3ファイル再生機能
const playMp3File = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(filePath);
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play().catch(reject);
  });
};

// 音声再生前後のMP3ファイル再生（重複防止）
let isBroadcastingStartPlaying = false;
let isBroadcastingEndPlaying = false;

const playBroadcastingStart = async (): Promise<void> => {
  if (isBroadcastingStartPlaying) {
    return;
  }
  
  isBroadcastingStartPlaying = true;
  try {
    await playMp3File('/data/broadcasting-start1.mp3');
  } catch (error) {
    console.error('放送開始音声再生エラー:', error);
  } finally {
    isBroadcastingStartPlaying = false;
  }
};

const playBroadcastingEnd = async (): Promise<void> => {
  if (isBroadcastingEndPlaying) {
    return;
  }
  
  isBroadcastingEndPlaying = true;
  try {
    await playMp3File('/data/broadcasting-end1.mp3');
  } catch (error) {
    console.error('放送終了音声再生エラー:', error);
  } finally {
    isBroadcastingEndPlaying = false;
  }
};

// グローバルな音声再生状態管理（重複防止）
let globalAudioPlaying = false;
let currentPlayingEntryId: string | null = null;
let audioQueue: Array<{entry: ScheduleEntry, timing: number, config: AppConfig, monitor: MonitorConfig, isMainEntry: boolean}> = [];
let isProcessingAudioQueue = false;

// 音声再生の優先順位を決定する関数
const getAudioPriority = (entry: ScheduleEntry, monitor: MonitorConfig, isMainEntry: boolean): number => {
  // 第1優先順位：入線時刻の小さい順
  const [hours, minutes] = entry.arrivalTime?.split(':').map(Number) || [0, 0];
  const arrivalTimeMinutes = hours * 60 + minutes;
  
  // 第2優先順位：上段・下段の順（上段=0, 下段=1）
  const segmentPriority = isMainEntry ? 0 : 1;
  
  // 第3優先順位：左・右の順（左=0, 右=1）
  const sidePriority = monitor.id === "1" ? 0 : 1;
  
  // 優先順位を組み合わせ（入線時刻が最重要）
  return arrivalTimeMinutes * 10000 + segmentPriority * 100 + sidePriority;
};

// 音声キュー処理関数
const processAudioQueue = async () => {
  if (isProcessingAudioQueue || audioQueue.length === 0) {
    return;
  }
  
  isProcessingAudioQueue = true;
  
  // 優先順位に基づいてキューをソート
  audioQueue.sort((a, b) => {
    const priorityA = getAudioPriority(a.entry, a.monitor, a.isMainEntry);
    const priorityB = getAudioPriority(b.entry, b.monitor, b.isMainEntry);
    return priorityA - priorityB;
  });
  
  console.log('音声再生優先順位:', audioQueue.map(item => ({
    entry: item.entry.supplierName,
    arrivalTime: item.entry.arrivalTime,
    monitor: item.monitor.title,
    isMainEntry: item.isMainEntry,
    priority: getAudioPriority(item.entry, item.monitor, item.isMainEntry)
  })));
  
  while (audioQueue.length > 0) {
    const { entry, timing, config, monitor } = audioQueue.shift()!;
    await playAudioDirectly(entry, timing, config, monitor);
  }
  
  isProcessingAudioQueue = false;
};

// 音声再生関数
const playAudioDirectly = async (entry: ScheduleEntry, timing: number, currentConfig: AppConfig, monitor: MonitorConfig) => {
  // 同じ便の重複再生を完全に防止
  if (currentPlayingEntryId === entry.id || isEntryAlreadyPlayed(entry.id)) {
    console.log(`音声再生スキップ: 同じ便が既に再生中または再生済み (entryId=${entry.id})`);
    return;
  }

  console.log(`音声再生開始: ${entry.supplierName} (timing: ${timing})`);
  globalAudioPlaying = true;
  currentPlayingEntryId = entry.id;

  // 音声再生状態を開始
  startPlayback(entry.id, entry.arrivalTime || '');

  try {
    await playBroadcastingStart();
    
    const speechText = formatSpeech(currentConfig.speechFormat, entry);
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = monitor.speechLang || 'ja-JP';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);
      window.speechSynthesis.speak(utterance);
    });

    await playBroadcastingEnd();
    
    // 再生記録を保存
    const record = {
      entryId: entry.id,
      timingMinutes: timing,
      playedAt: new Date().toISOString(),
      arrivalTime: entry.arrivalTime
    };
    savePlaybackRecord(record);
    console.log(`音声再生完了: ${entry.supplierName} (timing: ${timing})`);
  } catch (error) {
    console.error('音声再生エラー:', error);
  } finally {
    globalAudioPlaying = false;
    currentPlayingEntryId = null;
    
    // 音声再生状態を終了
    endPlayback();
  }
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
  setData: (data: any) => void, 
  setError: (error: string | null) => void, 
  setLoading: (loading: boolean) => void,
  setCurrentConfig: (config: AppConfig) => void,
  setCurrentMonitor: (monitor: MonitorConfig) => void,
  setDisplayEntries: (entries: any[]) => void
) => {
  console.log(`統合ポーリング実行: hasAudio=${monitor.hasAudio}, SPEECH_SUPPORTED=${SPEECH_SUPPORTED}`);
  
  // 1. 設定ファイル取得
  const latestConfig = await fetchConfig();
  if (!latestConfig) {
    console.log('設定ファイル取得失敗、既存設定を使用');
  } else {
    console.log('設定ファイル取得成功');
    const monitorConfig = latestConfig.monitors.find(m => m.id === monitor.id);
    if (monitorConfig?.audioSettings?.timings) {
      console.log(`現在のtimings設定: [${monitorConfig.audioSettings.timings.join(', ')}]`);
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
    console.log('データ取得失敗');
    setError('データの取得に失敗しました');
    setLoading(false);
    return;
  }
  console.log(`データ取得完了: エントリ数=${newData.entries.length}`);
  console.log(`データURL: ${monitor.dataUrl}`);
  console.log(`最新エントリ: ${newData.entries.slice(-3).map(e => `${e.supplierName}(${e.arrivalTime})`).join(', ')}`);
  
  // 3. 表示用エントリの処理（全てのロジックを統合）
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const beforeMinutes = config.displaySettings?.beforeMinutes ?? 30;
  
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
    const arrivalTime = hours * 60 + minutes;
    const isAfterCurrentTime = arrivalTime >= currentTime;
    const timeDiff = arrivalTime - currentTime;
    const shouldShow = isAfterCurrentTime && timeDiff <= beforeMinutes;
    return shouldShow;
  });
  
  // データを状態に保存
  setData(newData);
  setDisplayEntries(displayEntries);
  setError(null);
  setLoading(false);
  
  // 4. 音声チェック（音声が有効な場合のみ）
  if (monitor.hasAudio && SPEECH_SUPPORTED) {
    if (globalAudioPlaying) {
      console.log(`音声再生中のためスキップ`);
      return;
    }

    // 最新の設定からtimingsを取得
    const monitorConfig = config.monitors.find(m => m.id === monitor.id);
    const audioSettings = monitorConfig?.audioSettings || monitor.audioSettings;
    const speechTimings = audioSettings?.timings ?? [0];
    
    console.log(`音声チェック: 使用中のtimings=[${speechTimings.join(', ')}]`);
    console.log(`音声チェック開始: 現在時刻=${currentTime}分, 表示エントリ数=${displayEntries.length}`);
    console.log(`ソート済みエントリ: ${displayEntries.map(e => `${e.supplierName}(${e.arrivalTime})`).join(', ')}`);
    
    for (const entry of displayEntries) {
      if (!entry.id || !entry.arrivalTime) continue;

      // 既に再生済みの便はスキップ
      if (isEntryAlreadyPlayed(entry.id)) {
        console.log(`エントリスキップ: 既に再生済み (entryId=${entry.id})`);
        continue;
      }

      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      
      console.log(`エントリチェック: ${entry.supplierName} (到着時刻=${arrivalTime}分, ID=${entry.id})`);

      const pastTimings = speechTimings.filter(timingMinutes => {
        const speechTime = arrivalTime - timingMinutes;
        const shouldPlay = currentTime >= speechTime;
        console.log(`  timing=${timingMinutes}分, 音声時刻=${speechTime}分, 再生対象=${shouldPlay}`);
        return shouldPlay;
      });

      console.log(`  過ぎているタイミング: [${pastTimings.join(', ')}]`);

      if (pastTimings.length === 0) {
        console.log(`  音声再生対象なし`);
        continue;
      }

      // 複数のタイミングが条件を満たす場合、最小値（最も近いタイミング）を選択
      const sortedPastTimings = [...pastTimings].sort((a, b) => a - b);
      console.log(`  ソート済みタイミング: [${sortedPastTimings.join(', ')}]`);

      let targetTiming = null;
      for (const timingMinutes of sortedPastTimings) {
        const hasPlayed = hasBeenPlayed(entry.id, timingMinutes);
        console.log(`  timing=${timingMinutes}分, 再生済み=${hasPlayed}`);
        if (!hasPlayed) {
          targetTiming = timingMinutes;
          break;
        }
      }

      if (targetTiming !== null) {
        console.log(`  選択されたタイミング: ${targetTiming}分（最小値）`);
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
          speechLang: monitor.speechLang || 'ja-JP'
        });
        
        // 非同期でグローバル音声キュー処理を実行
        setTimeout(() => {
          processGlobalAudioQueue().catch(error => {
            console.error(`グローバル音声キュー処理エラー:`, error);
          });
        }, 0);
        // 連続再生のためbreakを削除
      } else {
        console.log(`  全てのタイミングが再生済み`);
      }
    }
  } else {
    console.log(`音声チェック条件未満: hasAudio=${monitor.hasAudio}, SPEECH_SUPPORTED=${SPEECH_SUPPORTED}`);
  }
};

// メモリ使用量監視
const logMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.log('メモリ使用量:', {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    });
  }
};

// シンプルポーリングフック（setTimeoutの連鎖）
export const useSimplePolling = (monitor: MonitorConfig, appConfig: AppConfig) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(appConfig);
  const [currentMonitor, setCurrentMonitor] = useState<MonitorConfig>(monitor);
  const [displayEntries, setDisplayEntries] = useState<any[]>([]);
  
  let timeoutId: number | null = null;
  let isRunning = false;

  const startPolling = () => {
    console.log('シンプルポーリング開始');
    
    // 非同期でローカルストレージの初期化処理を実行（ポーリングをブロックしない）
    setTimeout(() => {
      try {
        // 古い記録をクリーンアップ
        cleanupOldRecords();
        
        // 壊れたデータを修復（ローカルストレージをクリア）
        const records = JSON.parse(localStorage.getItem('audioPlaybackRecords') || '[]');
        const hasCorruptedData = records.some((record: any) => 
          !record.entryId || typeof record.entryId !== 'string' || 
          record.timingMinutes === null || typeof record.timingMinutes !== 'number'
        );
        
        if (hasCorruptedData) {
          console.log('壊れたデータを検出、ローカルストレージをクリア');
          clearPlaybackRecords();
        }
      } catch (error) {
        console.log('ローカルストレージデータが壊れています、クリアします');
        clearPlaybackRecords();
      }
    }, 0);
    
    isRunning = true;
    
    const scheduleNext = async () => {
      if (!isRunning) return;
      
      try {
        // メモリ使用量をログ出力
        logMemoryUsage();
        await unifiedPolling(monitor, appConfig, setData, setError, setLoading, setCurrentConfig, setCurrentMonitor, setDisplayEntries);
      } catch (error) {
        console.error('ポーリングエラー:', error);
      }
      
      if (isRunning) {
        timeoutId = window.setTimeout(scheduleNext, 30000);
      }
    };
    
    // 初回実行
    scheduleNext();
    
    return () => {
      console.log('シンプルポーリング停止');
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  };

  return { startPolling, data, loading, error, currentConfig, currentMonitor, displayEntries };
};
