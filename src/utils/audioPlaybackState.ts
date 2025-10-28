// 音声再生状態を管理するユーティリティ
import { logger } from './logger';

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
  // 既に処理済みまたは処理中の場合はスキップ
  if (processedEntries.has(item.entryId)) {
    logger.debug(`音声キューに既に存在するためスキップ: ${item.supplierName} (${item.arrivalTime})`);
    return;
  }
  
  // 既に同じentryIdの音声がキューに存在する場合はスキップ
  const existingItem = globalAudioQueue.find(queueItem => queueItem.entryId === item.entryId);
  if (existingItem) {
    logger.debug(`音声キューに既に存在するためスキップ: ${item.supplierName} (${item.arrivalTime})`);
    return;
  }
  
  logger.info(`音声キューに追加: ${item.supplierName} (${item.arrivalTime}) - ${item.monitorTitle}`);
  globalAudioQueue.push(item);
  processedEntries.add(item.entryId);
};

// グローバル音声キューの優先順位を計算
const getGlobalAudioPriority = (item: GlobalAudioQueueItem): number => {
  // 第1優先順位：入線時刻の小さい順
  const [hours, minutes] = item.arrivalTime.split(':').map(Number);
  const arrivalTimeMinutes = hours * 60 + minutes;
  
  // 第2優先順位：上段・下段の順（上段=0, 下段=1）
  const segmentPriority = item.isMainEntry ? 0 : 1;
  
  // 第3優先順位：左・右の順（左=0, 右=1）
  // 分割表示の場合は実際の左右の位置を使用、そうでなければmonitorIdで判定
  const sidePriority = item.isLeftSide !== undefined 
    ? (item.isLeftSide ? 0 : 1)  // 分割表示時は実際の左右の位置
    : (item.monitorId === "1" ? 0 : 1);  // 単一表示時はmonitorIdで判定
  
  // 優先順位を組み合わせ（入線時刻が最重要）
  return arrivalTimeMinutes * 10000 + segmentPriority * 100 + sidePriority;
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
const playGlobalAudio = async (item: GlobalAudioQueueItem) => {
  // 音声再生開始のINFOログ
  logger.info(`音声再生開始: ${item.supplierName} (${item.arrivalTime}) - ${item.monitorTitle}`);
  
  // 音声再生状態を開始
  startPlayback(item.entryId, item.arrivalTime);
  
  // 実際に再生されたタイミングを計算
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const arrivalTimeMinutes = parseInt(item.arrivalTime.split(':')[0]) * 60 + parseInt(item.arrivalTime.split(':')[1]);
  const timeDifference = arrivalTimeMinutes - currentTime;
  
  // 設定されているタイミングの中から最も近い値を選択
  // 設定から動的に取得
  let availableTimings: number[] = []; // デフォルト値（空配列）
  
  try {
    // 設定ファイルから動的に取得（キャッシュなし、毎回取得）
    const response = await fetch('/config/monitor-config.json', { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (response.ok) {
      const config = await response.json();
      const monitor = config.monitors.find((m: { id: string; audioSettings?: { timings?: number[] } }) => m.id === item.monitorId);
      if (monitor && monitor.audioSettings && monitor.audioSettings.timings) {
        availableTimings = monitor.audioSettings.timings.map((t: number) => Number(t));
      }
    }
  } catch (error) {
    logger.error('設定ファイルの取得に失敗:', error);
    throw new Error('設定ファイルの取得に失敗しました');
  }
  
  if (availableTimings.length === 0) {
    logger.error('タイミング設定が空です');
    throw new Error('タイミング設定が取得できませんでした');
  }
  
  const sortedTimings = availableTimings.sort((a, b) => b - a);
  
  // 時間差以上のタイミングを選択（時間差が大きいほど、より大きなタイミングを選択）
  const validTimings = sortedTimings.filter(timing => timing >= timeDifference);
  const playedTiming = validTimings.length > 0 ? Math.min(...validTimings) : undefined;
  
  if (playedTiming === undefined) {
    logger.error(`時間差${timeDifference}分に対して適切なタイミングが見つかりません。利用可能なタイミング: ${sortedTimings}`);
    throw new Error(`時間差${timeDifference}分に対して適切なタイミングが見つかりません`);
  }
  
  try {
  // 放送開始音声
  await playBroadcastingStart();

  // チャイムと音声合成の間に間隔を設ける
  await new Promise(resolve => setTimeout(resolve, 500));

  // 音声合成
  
  try {
    // 音声合成が利用可能かチェック
    if (!('speechSynthesis' in window)) {
      throw new Error('音声合成がサポートされていません');
    }
    
    // AudioContext の状態を確認・復旧
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch {
      // AudioContext確認エラーは無視
    }
    
    // 既存の音声合成を停止
    window.speechSynthesis.cancel();

    // 音声が読み込まれるまで少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const utterance = new SpeechSynthesisUtterance(item.speechText);
    utterance.lang = item.speechLang;
    utterance.rate = 1.0; // デフォルト速度に変更
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // 日本語音声を明示的に設定
    const voices = window.speechSynthesis.getVoices();
    
    const japaneseVoice = voices.find(voice => 
      voice.lang.startsWith('ja') && voice.name.includes('Japanese')
    );
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    } else {
      // 日本語音声が見つからない場合は、ja-JPの音声を探す
      const jaVoice = voices.find(voice => voice.lang === 'ja-JP');
      if (jaVoice) {
        utterance.voice = jaVoice;
      }
    }

    await new Promise<void>((resolve, reject) => {
      let isResolved = false;
      let hasStarted = false;
      
      utterance.onstart = () => {
        hasStarted = true;
      };
      
      utterance.onend = () => {
        if (!isResolved) {
          // onstartが発生していない場合でも、ブラウザの制限の可能性があるため
          // 音声合成の状態を直接確認する
          setTimeout(() => {
            const isActuallySpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
            
            if (!hasStarted && !isActuallySpeaking) {
              isResolved = true;
              reject(new Error('音声合成が実際には開始されていません'));
              return;
            }
            
            isResolved = true;
            resolve();
          }, 100);
        }
      };
      
      utterance.onerror = (error) => {
        if (!isResolved) {
          logger.error('音声合成エラー:', error);
          isResolved = true;
          reject(new Error('音声合成エラー: ' + error.error));
        }
      };
      
      // 音声合成を開始
      try {
        // SpeechSynthesis のキューを完全にクリアしてから開始
        window.speechSynthesis.cancel();
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 50);
        
      } catch (error) {
        logger.error('音声合成開始エラー:', error);
        if (!isResolved) {
          isResolved = true;
          reject(new Error('音声合成開始エラー: ' + error));
        }
        return;
      }
      
      // 音声合成が開始されたかチェック（3秒後）
      setTimeout(() => {
        if (!hasStarted && !isResolved) {
          // onstartが発生しなくても、onendイベントを待機する
        }
      }, 3000);
      
      // タイムアウト設定（10秒）
      setTimeout(() => {
        if (!isResolved) {
          window.speechSynthesis.cancel();
          isResolved = true;
          reject(new Error('音声合成タイムアウト'));
        }
      }, 10000);
    });
  } catch (error) {
    logger.error('音声合成エラー:', error);
    throw error; // エラーを再スローして、音声再生全体をスキップ
  }

  // 音声合成と終了チャイムの間に間隔を設ける
  await new Promise(resolve => setTimeout(resolve, 100));

  // 放送終了音声
  await playBroadcastingEnd();
    
    // ローカルストレージに再生記録を保存
    try {
      const { savePlaybackRecord } = await import('./audioPlaybackManager');
      const record = {
        entryId: item.entryId,
        timingMinutes: playedTiming, // 実際に再生されたタイミング
        playedAt: new Date().toISOString(),
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
    // 処理済みエントリから削除（次回の再生のために）
    processedEntries.delete(item.entryId);
  }
};

// MP3ファイル再生機能（グローバル用）
export const playBroadcastingStart = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio('/data/broadcasting-start1.mp3');
    
    audio.onended = () => {
      resolve();
    };
    
    audio.onerror = (error) => {
      logger.error('放送開始チャイム再生エラー:', error);
      reject(error);
    };
    
    audio.play().catch((playError) => {
      logger.error('放送開始チャイム再生開始エラー:', playError);
      reject(playError);
    });
  });
};

export const playBroadcastingEnd = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio('/data/broadcasting-end1.mp3');
    
    audio.onended = () => {
      resolve();
    };
    
    audio.onerror = (error) => {
      logger.error('放送終了チャイム再生エラー:', error);
      reject(error);
    };
    
    audio.play().catch((playError) => {
      logger.error('放送終了チャイム再生開始エラー:', playError);
      reject(playError);
    });
  });
};
