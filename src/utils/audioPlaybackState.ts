// 音声再生状態を管理するユーティリティ

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentEntryId: string | null;
  currentEntryArrivalTime: string | null;
}

// グローバル状態
let globalPlaybackState: AudioPlaybackState = {
  isPlaying: false,
  currentEntryId: null,
  currentEntryArrivalTime: null
};

// 再生済み便の記録（重複防止用）
let playedEntries: Set<string> = new Set();

// グローバル音声キュー（全体の優先順位で管理）
interface GlobalAudioQueueItem {
  entryId: string;
  supplierName: string;
  arrivalTime: string;
  monitorId: string;
  monitorTitle: string;
  isMainEntry: boolean;
  timing: number;
  speechText: string;
  speechLang: string;
}

let globalAudioQueue: GlobalAudioQueueItem[] = [];
let isProcessingGlobalQueue = false;

// 状態変更のリスナー
type StateChangeListener = (state: AudioPlaybackState) => void;
const listeners: Set<StateChangeListener> = new Set();

// 状態を更新
export const updatePlaybackState = (state: Partial<AudioPlaybackState>) => {
  console.log('音声再生状態更新:', state);
  globalPlaybackState = { ...globalPlaybackState, ...state };
  console.log('更新後の状態:', globalPlaybackState);
  
  // 全てのリスナーに通知
  listeners.forEach(listener => {
    try {
      listener(globalPlaybackState);
    } catch (error) {
      console.error('状態変更リスナーエラー:', error);
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
  globalAudioQueue.push(item);
  console.log('グローバル音声キューに追加:', item);
};

// グローバル音声キューの優先順位を計算
const getGlobalAudioPriority = (item: GlobalAudioQueueItem): number => {
  // 第1優先順位：入線時刻の小さい順
  const [hours, minutes] = item.arrivalTime.split(':').map(Number);
  const arrivalTimeMinutes = hours * 60 + minutes;
  
  // 第2優先順位：上段・下段の順（上段=0, 下段=1）
  const segmentPriority = item.isMainEntry ? 0 : 1;
  
  // 第3優先順位：左・右の順（左=0, 右=1）
  const sidePriority = item.monitorId === "1" ? 0 : 1;
  
  // 優先順位を組み合わせ（入線時刻が最重要）
  return arrivalTimeMinutes * 10000 + segmentPriority * 100 + sidePriority;
};

// グローバル音声キューを処理
export const processGlobalAudioQueue = async () => {
  if (isProcessingGlobalQueue || globalAudioQueue.length === 0) {
    return;
  }
  
  isProcessingGlobalQueue = true;
  
  // 優先順位に基づいてキューをソート
  globalAudioQueue.sort((a, b) => {
    const priorityA = getGlobalAudioPriority(a);
    const priorityB = getGlobalAudioPriority(b);
    return priorityA - priorityB;
  });
  
  console.log('グローバル音声再生優先順位:', globalAudioQueue.map(item => ({
    entry: item.supplierName,
    arrivalTime: item.arrivalTime,
    monitor: item.monitorTitle,
    isMainEntry: item.isMainEntry,
    priority: getGlobalAudioPriority(item)
  })));
  
  // キューを順次処理
  while (globalAudioQueue.length > 0) {
    const item = globalAudioQueue.shift()!;
    
    // 既に再生済みの便はスキップ
    if (isEntryAlreadyPlayed(item.entryId)) {
      console.log(`音声再生スキップ: 既に再生済み (entryId=${item.entryId})`);
      continue;
    }
    
    await playGlobalAudio(item);
  }
  
  isProcessingGlobalQueue = false;
};

// グローバル音声再生
const playGlobalAudio = async (item: GlobalAudioQueueItem) => {
  console.log(`グローバル音声再生開始: ${item.supplierName} (${item.arrivalTime})`);
  
  // 音声再生状態を開始
  startPlayback(item.entryId, item.arrivalTime);
  
  try {
    // 放送開始音声
    await playBroadcastingStart();
    
    // 音声合成
    const utterance = new SpeechSynthesisUtterance(item.speechText);
    utterance.lang = item.speechLang;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);
      window.speechSynthesis.speak(utterance);
    });

    // 放送終了音声
    await playBroadcastingEnd();
    
    console.log(`グローバル音声再生完了: ${item.supplierName}`);
  } catch (error) {
    console.error('グローバル音声再生エラー:', error);
  } finally {
    // 音声再生状態を終了
    endPlayback();
  }
};

// MP3ファイル再生機能（グローバル用）
const playBroadcastingStart = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio('/data/broadcasting-start1.mp3');
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play().catch(reject);
  });
};

const playBroadcastingEnd = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio('/data/broadcasting-end1.mp3');
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play().catch(reject);
  });
};
