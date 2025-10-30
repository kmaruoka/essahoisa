// 音声再生状態を管理するユーティリティ
import { logger } from './logger';
import { AudioService } from '../services/audioService';

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentEntryId: string | null;
  currentEntryArrivalTime: string | null;
}

// 音声合成の動作テスト結果（削除）

// グローバル状態
let globalPlaybackState: AudioPlaybackState = {
  isPlaying: false,
  currentEntryId: null,
  currentEntryArrivalTime: null
};

// 再生済み便の記録（重複防止用）
const playedEntries: Set<string> = new Set();

// グローバル音声キュー（全体の優先順位で管理）
interface GlobalAudioQueueItem {
  entryId: string;
  supplierName: string;
  arrivalTime: string;
  arrivalDatetime?: number; // 正規化された到着時刻（分）
  monitorId: string;
  monitorTitle: string;
  isMainEntry: boolean;
  timing: number;
  speechText: string;
  speechLang: string;
  isLeftSide?: boolean; // 分割表示時の左右の位置（true=左、false=右）
}

const globalAudioQueue: GlobalAudioQueueItem[] = [];
let isProcessingGlobalQueue = false;
const processedEntries = new Set<string>(); // 処理済みまたは処理中のエントリを追跡
let batchProcessingTimeout: number | null = null; // バッチ処理用のタイムアウト

// 状態変更のリスナー
type StateChangeListener = (state: AudioPlaybackState) => void;
const listeners: Set<StateChangeListener> = new Set();

// 状態を更新
export const updatePlaybackState = (state: Partial<AudioPlaybackState>) => {
  globalPlaybackState = { ...globalPlaybackState, ...state };
  
  // 全てのリスナーに通知
  listeners.forEach(listener => {
    try {
      listener(globalPlaybackState);
    } catch (error) {
      logger.error('状態変更リスナーエラー:', error);
    }
  });
};

// 現在の状態を取得
export const getPlaybackState = (): AudioPlaybackState => {
  return { ...globalPlaybackState };
};

// 状態変更リスナーを追加
export const addPlaybackStateListener = (listener: StateChangeListener): (() => void) => {
  listeners.add(listener);
  
  // クリーンアップ関数を返す
  return () => {
    listeners.delete(listener);
  };
};

// 音声再生開始
export const startPlayback = (entryId: string, arrivalTime: string) => {
  // 再生済み記録に追加
  playedEntries.add(entryId);
  
  updatePlaybackState({
    isPlaying: true,
    currentEntryId: entryId,
    currentEntryArrivalTime: arrivalTime
  });
};

// 音声再生終了
export const endPlayback = () => {
  updatePlaybackState({
    isPlaying: false,
    currentEntryId: null,
    currentEntryArrivalTime: null
  });
};

// 特定の便が再生中かチェック
export const isEntryPlaying = (entryId: string): boolean => {
  return globalPlaybackState.isPlaying && globalPlaybackState.currentEntryId === entryId;
};

// 特定の便が既に再生済みかチェック
export const isEntryAlreadyPlayed = (entryId: string): boolean => {
  return playedEntries.has(entryId);
};

// 再生済み記録をクリア（必要に応じて）
export const clearPlayedEntries = () => {
  playedEntries.clear();
};

// グローバル音声キューに追加
export const addToGlobalAudioQueue = (item: GlobalAudioQueueItem) => {
  // 既に再生済みの場合はスキップ
  if (isEntryAlreadyPlayed(item.entryId)) {
    return;
  }
  
  // 既に処理済みまたは処理中の場合はスキップ
  if (processedEntries.has(item.entryId)) {
    return;
  }
  
  // 既に同じentryIdの音声がキューに存在する場合はスキップ
  const existingItem = globalAudioQueue.find(queueItem => queueItem.entryId === item.entryId);
  if (existingItem) {
    return;
  }
  
  logger.info(`音声キューに追加: ${item.supplierName} (${item.arrivalTime}) - ${item.monitorTitle}`);
  globalAudioQueue.push(item);
  processedEntries.add(item.entryId);
  
  // バッチ処理をスケジュール（既存のタイムアウトをクリアして新しいタイムアウトを設定）
  if (batchProcessingTimeout) {
    clearTimeout(batchProcessingTimeout);
  }
  
  batchProcessingTimeout = window.setTimeout(() => {
    processGlobalAudioQueue().catch(error => {
      logger.error(`バッチ音声キュー処理エラー:`, error);
    });
  }, 500); // 500ms後にバッチ処理を実行（全モニターの音声を確実に収集）
};

// グローバル音声キューの優先順位を計算
const getGlobalAudioPriority = (item: GlobalAudioQueueItem): number => {
  // 第1優先順位：arrivalDatetime（正規化済み）の小さい順
  const arrivalTimeMinutes = item.arrivalDatetime || 0;
  
  // 第2優先順位：上段・下段の順（上段=0, 下段=1）
  const segmentPriority = item.isMainEntry ? 0 : 1;
  
  // 第3優先順位：左・右の順（左=0, 右=1）
  // 分割表示の場合は実際の左右の位置を使用、そうでなければmonitorIdで判定
  let sidePriority: number;
  if (item.isLeftSide !== undefined) {
    // 分割表示時は実際の左右の位置を使用
    sidePriority = item.isLeftSide ? 0 : 1;
  } else {
    // 単一表示時またはisLeftSideが未定義の場合はmonitorIdで判定
    // monitorId="1"は左、monitorId="2"は右とする
    sidePriority = item.monitorId === "1" ? 0 : 1;
  }
  
  // 正しい優先順位の重み付け
  // 第1優先：到着時刻（分） × 1000000
  // 第2優先：上段・下段 × 10000  
  // 第3優先：左・右 × 100
  const priority = arrivalTimeMinutes * 1000000 + segmentPriority * 10000 + sidePriority * 100;
  
  return priority;
};

// グローバル音声キューを処理
export const processGlobalAudioQueue = async () => {
  if (isProcessingGlobalQueue) {
    return;
  }
  
  if (globalAudioQueue.length === 0) {
    return;
  }
  
  isProcessingGlobalQueue = true;
  
  // 優先順位に基づいてキューをソート
  globalAudioQueue.sort((a, b) => {
    const priorityA = getGlobalAudioPriority(a);
    const priorityB = getGlobalAudioPriority(b);
    return priorityA - priorityB;
  });
  
  // キューを順次処理（直列実行）
  while (globalAudioQueue.length > 0) {
    const item = globalAudioQueue.shift()!;
    
    // 既に再生済みの便はスキップ
    if (isEntryAlreadyPlayed(item.entryId)) {
      continue;
    }
    
    // 音声再生を実行（直列処理）
    try {
      await playGlobalAudio(item);
    } catch (error) {
      logger.error(`音声再生エラー: ${item.supplierName} (${item.arrivalTime})`, error);
      // エラーが発生しても次の音声再生を継続
    }
  }
  
  isProcessingGlobalQueue = false;
　};



// グローバル音声再生
const audioService = new AudioService();
const playGlobalAudio = async (item: GlobalAudioQueueItem) => {
  // 音声再生開始のINFOログ
  logger.info(`音声再生開始: ${item.supplierName} (${item.arrivalTime}) - ${item.monitorTitle}`);
  
  // 音声再生状態を開始
  startPlayback(item.entryId, item.arrivalTime);
  
  
  try {
    await audioService.playChime('start');
    await new Promise(resolve => setTimeout(resolve, 500));
    await audioService.speakText(item.speechText, { lang: item.speechLang, rate: 1.0, pitch: 1.0, volume: 1.0 });
    await new Promise(resolve => setTimeout(resolve, 100));
    await audioService.playChime('end');
    
    // ローカルストレージに再生記録を保存
    try {
      const { savePlaybackRecord } = await import('./audioPlaybackManager');
      const getJstISOString = () => {
        const now = new Date();
        const jstMs = now.getTime() + 9 * 60 * 60 * 1000; // UTC→JST
        const jst = new Date(jstMs);
        const pad = (n: number, w = 2) => String(n).padStart(w, '0');
        const yyyy = jst.getUTCFullYear();
        const mm = pad(jst.getUTCMonth() + 1);
        const dd = pad(jst.getUTCDate());
        const hh = pad(jst.getUTCHours());
        const mi = pad(jst.getUTCMinutes());
        const ss = pad(jst.getUTCSeconds());
        const ms = pad(jst.getUTCMilliseconds(), 3);
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+09:00`;
      };
      const record = {
        entryId: item.entryId,
        timingMinutes: item.timing, // 実際に再生されたタイミング
        playedAt: getJstISOString(),
        arrivalTime: item.arrivalTime
      };
      savePlaybackRecord(record);
    } catch (error) {
      logger.error('再生記録の保存に失敗:', error);
    }
  } catch (error) {
    logger.error('グローバル音声再生エラー:', error);
  } finally {
    // 音声再生状態を終了
    endPlayback();
    // processedEntriesからは削除しない（重複再生を防ぐため）
    // 再生済み記録（playedEntries）で重複を防ぐ
  }
};
