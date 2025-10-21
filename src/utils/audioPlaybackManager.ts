// 音声再生完了状態をローカルストレージで管理するユーティリティ

export interface PlaybackRecord {
  entryId: string;
  timingMinutes: number;
  playedAt: string; // ISO string
  arrivalTime: string; // HH:MM format
}

const STORAGE_KEY = 'audioPlaybackRecords';

// 再生完了記録を取得
export const getPlaybackRecords = (): PlaybackRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('ローカルストレージからの再生記録取得エラー:', error);
    return [];
  }
};

// 再生完了記録を保存
export const savePlaybackRecord = (record: PlaybackRecord): void => {
  try {
    const records = getPlaybackRecords();
    const newRecords = [...records, record];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
  } catch (error) {
    console.error('ローカルストレージへの再生記録保存エラー:', error);
  }
};

// 特定の便の特定のタイミングで再生済みかチェック
export const hasBeenPlayed = (entryId: string, timingMinutes: number): boolean => {
  const records = getPlaybackRecords();
  return records.some(record => 
    record.entryId === entryId && record.timingMinutes === timingMinutes
  );
};

// 特定の便の特定のタイミングの再生記録を取得
export const getPlaybackRecord = (entryId: string, timingMinutes: number): PlaybackRecord | null => {
  const records = getPlaybackRecords();
  return records.find(record => 
    record.entryId === entryId && record.timingMinutes === timingMinutes
  ) || null;
};

// 古い記録をクリーンアップ（24時間以上前の記録を削除）
export const cleanupOldRecords = (): void => {
  try {
    const records = getPlaybackRecords();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentRecords = records.filter(record => {
      const playedAt = new Date(record.playedAt);
      return playedAt > oneDayAgo;
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentRecords));
  } catch (error) {
    console.error('古い再生記録のクリーンアップエラー:', error);
  }
};

// 特定の便の記録をクリア（テスト用）
export const clearPlaybackRecords = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('再生記録のクリアエラー:', error);
  }
};

// 特定の便の記録をクリア
export const clearPlaybackRecordsForEntry = (entryId: string): void => {
  try {
    const records = getPlaybackRecords();
    const filteredRecords = records.filter(record => record.entryId !== entryId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
  } catch (error) {
    console.error('特定便の再生記録クリアエラー:', error);
  }
};
