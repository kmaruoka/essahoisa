// 音声再生完了状態をローカルストレージで管理するユーティリティ
import { logger } from './logger';

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
    logger.error('ローカルストレージからの再生記録取得エラー:', error);
    return [];
  }
};

// 再生完了記録を保存（最後の再生タイミングのみ保存）
export const savePlaybackRecord = (record: PlaybackRecord): void => {
  try {
    const records = getPlaybackRecords();
    const entryRecords = records.filter(r => r.entryId === record.entryId);
    
    // 既存の記録がある場合、最後の再生タイミングのみを保持
    if (entryRecords.length > 0) {
      const lastTiming = Math.min(...entryRecords.map(r => r.timingMinutes));
      const newLastTiming = Math.min(lastTiming, record.timingMinutes);
      
      // 既存の記録を削除
      const filteredRecords = records.filter(r => r.entryId !== record.entryId);
      
      // 最後の再生タイミングの記録のみを保存
      const newRecord = { ...record, timingMinutes: newLastTiming };
      const newRecords = [...filteredRecords, newRecord];
      
      // ストレージ容量チェック
      const dataToStore = JSON.stringify(newRecords);
      if (dataToStore.length > 4 * 1024 * 1024) { // 4MB制限
        logger.warn('ローカルストレージの容量が大きすぎます。古いデータをクリアしてから保存します。');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([newRecord]));
        return;
      }
      
      localStorage.setItem(STORAGE_KEY, dataToStore);
    } else {
      // 初回記録の場合はそのまま保存
      const newRecords = [...records, record];
      
      // ストレージ容量チェック
      const dataToStore = JSON.stringify(newRecords);
      if (dataToStore.length > 4 * 1024 * 1024) { // 4MB制限
        logger.warn('ローカルストレージの容量が大きすぎます。古いデータをクリアしてから保存します。');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([record]));
        return;
      }
      
      localStorage.setItem(STORAGE_KEY, dataToStore);
    }
  } catch (error) {
    logger.error('ローカルストレージへの再生記録保存エラー:', error);
    // エラーが発生した場合は強制クリアしてから再試行
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record]));
      logger.warn('エラー発生により強制的に記録を保存しました');
    } catch (fallbackError) {
      logger.error('強制保存も失敗:', fallbackError);
    }
  }
};

// 特定の便の特定のタイミングで再生済みかチェック
export const hasBeenPlayed = (entryId: string, timingMinutes: number): boolean => {
  const records = getPlaybackRecords();
  const entryRecords = records.filter(record => record.entryId === entryId);
  
  if (entryRecords.length === 0) {
    return false;
  }
  
  // 現在の日付を取得
  const now = new Date();
  const today = now.toDateString();
  
  // 今日の記録のみを対象とする
  const todayRecords = entryRecords.filter(record => {
    const playedDate = new Date(record.playedAt);
    return playedDate.toDateString() === today;
  });
  
  if (todayRecords.length === 0) {
    return false;
  }
  
  // より小さいタイミング（より近いタイミング）が再生済みの場合は、
  // より大きいタイミング（より遠いタイミング）も再生済みとみなす
  const minPlayedTiming = Math.min(...todayRecords.map(record => record.timingMinutes));
  return timingMinutes >= minPlayedTiming;
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
    
    // ストレージ容量チェック
    const dataToStore = JSON.stringify(recentRecords);
    if (dataToStore.length > 4 * 1024 * 1024) { // 4MB制限
      logger.warn('ローカルストレージの容量が大きすぎます。データを強制クリアします。');
      localStorage.setItem(STORAGE_KEY, '[]');
      return;
    }
    
    localStorage.setItem(STORAGE_KEY, dataToStore);
  } catch (error) {
    logger.error('古い再生記録のクリーンアップエラー:', error);
    // エラーが発生した場合は強制クリア
    try {
      localStorage.setItem(STORAGE_KEY, '[]');
      logger.warn('エラー発生によりローカルストレージを強制クリアしました');
    } catch (fallbackError) {
      logger.error('強制クリアも失敗:', fallbackError);
    }
  }
};

// 特定の便の記録をクリア（テスト用）
export const clearPlaybackRecords = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // 削除が成功したか確認
    const remaining = localStorage.getItem(STORAGE_KEY);
    if (remaining !== null) {
      logger.warn('ローカルストレージの削除が不完全です。強制クリアを試行します。');
      // 強制クリア: 空の配列を設定
      localStorage.setItem(STORAGE_KEY, '[]');
    }
  } catch (error) {
    logger.error('再生記録のクリアエラー:', error);
    // エラーが発生した場合の代替手段
    try {
      localStorage.setItem(STORAGE_KEY, '[]');
      logger.warn('代替手段でローカルストレージをクリアしました');
    } catch (fallbackError) {
      logger.error('代替手段でもクリアに失敗:', fallbackError);
    }
  }
};

// 特定の便の記録をクリア
export const clearPlaybackRecordsForEntry = (entryId: string): void => {
  try {
    const records = getPlaybackRecords();
    const filteredRecords = records.filter(record => record.entryId !== entryId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
  } catch (error) {
    logger.error('特定便の再生記録クリアエラー:', error);
  }
};

// デバッグ用: ローカルストレージの詳細情報を取得
export const getStorageDebugInfo = (): void => {
  try {
    const records = getPlaybackRecords();
    const rawData = localStorage.getItem(STORAGE_KEY);
    const dataSize = rawData ? rawData.length : 0;
    
    logger.debug('=== ローカルストレージ詳細情報 ===');
    logger.debug('キー:', STORAGE_KEY);
    logger.debug('レコード数:', records.length);
    logger.debug('データサイズ:', dataSize, 'bytes');
    logger.debug('データサイズ:', (dataSize / 1024).toFixed(2), 'KB');
    logger.debug('生データ:', rawData);
    logger.debug('パース後データ:', records);
    
    // 各レコードの詳細
    records.forEach((record, index) => {
      logger.debug(`レコード${index + 1}:`, {
        entryId: record.entryId,
        timingMinutes: record.timingMinutes,
        playedAt: record.playedAt,
        arrivalTime: record.arrivalTime,
        size: JSON.stringify(record).length
      });
    });
    
    // ブラウザのストレージ制限情報
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        logger.debug('ストレージ使用量:', estimate.usage, 'bytes');
        logger.debug('ストレージ制限:', estimate.quota, 'bytes');
        logger.debug('使用率:', ((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(2), '%');
      });
    }
    
    // ローカルストレージの削除テスト
    logger.debug('=== ローカルストレージ削除テスト ===');
    try {
      const testKey = 'test-delete-key';
      localStorage.setItem(testKey, 'test-value');
      logger.debug('テストキー設定完了');
      
      const beforeDelete = localStorage.getItem(testKey);
      logger.debug('削除前の値:', beforeDelete);
      
      localStorage.removeItem(testKey);
      const afterDelete = localStorage.getItem(testKey);
      logger.debug('削除後の値:', afterDelete);
      
      if (afterDelete === null) {
        logger.debug('✅ ローカルストレージ削除は正常に動作しています');
      } else {
        logger.debug('❌ ローカルストレージ削除が失敗しています');
      }
    } catch (error) {
      logger.error('削除テストエラー:', error);
    }
  } catch (error) {
    logger.error('デバッグ情報取得エラー:', error);
  }
};
