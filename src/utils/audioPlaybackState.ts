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
