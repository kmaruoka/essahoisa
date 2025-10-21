import { useEffect, useState } from 'react';
import type { MonitorConfig, AppConfig, ScheduleEntry } from '../types';
import { 
  savePlaybackRecord, 
  hasBeenPlayed, 
  cleanupOldRecords 
} from '../utils/audioPlaybackManager';
import { formatSpeech } from '../utils/formatSpeech';

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// MP3ファイル再生機能
const playMp3File = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(filePath);
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play().catch(reject);
  });
};

// 音声再生前後のMP3ファイル再生
const playBroadcastingStart = async (): Promise<void> => {
  try {
    await playMp3File('/data/broadcasting-start1.mp3');
  } catch (error) {
    console.error('放送開始音声再生エラー:', error);
  }
};

const playBroadcastingEnd = async (): Promise<void> => {
  try {
    await playMp3File('/data/broadcasting-end1.mp3');
  } catch (error) {
    console.error('放送終了音声再生エラー:', error);
  }
};

// デバッグ用：音声合成APIの状態確認
const checkSpeechSynthesis = () => {
  if (typeof window === 'undefined') return;
  
  console.log('音声合成API状態:', {
    speechSynthesis: !!window.speechSynthesis,
    voices: window.speechSynthesis?.getVoices?.()?.length || 0,
    speaking: window.speechSynthesis?.speaking || false,
    pending: window.speechSynthesis?.pending || false
  });
};

interface UseAudioPlaybackProps {
  monitor: MonitorConfig;
  appConfig: AppConfig;
  displayEntries: ScheduleEntry[];
  mainEntries: ScheduleEntry[];
  userInteracted: boolean;
  isLeft?: boolean;
}

export const useAudioPlayback = ({
  monitor,
  appConfig,
  displayEntries,
  mainEntries,
  userInteracted,
  isLeft = true
}: UseAudioPlaybackProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastPlayedEntry, setLastPlayedEntry] = useState<string | null>(null);
  const [timingCheckInterval, setTimingCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // モニター変更時の初期化
  useEffect(() => {
    setIsPlaying(false);
    setLastPlayedEntry(null);
    cleanupOldRecords();
  }, [monitor.id]);

  // 定期的なタイミングチェック
  useEffect(() => {
    if (!monitor.hasAudio || !SPEECH_SUPPORTED || !userInteracted) {
      return;
    }

    // 既存のインターバルをクリア
    if (timingCheckInterval) {
      clearInterval(timingCheckInterval);
    }

    // 30秒ごとにタイミングをチェック
    const interval = setInterval(() => {
      if (!displayEntries.length) {
        return;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // 音声設定を取得
      const audioSettings = monitor.audioSettings;
      const speechTimings = audioSettings?.timings ?? [0];

      displayEntries.forEach(entry => {
        if (!entry.id || !entry.arrivalTime) return;

        // 到着時刻を分単位に変換
        const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
        const arrivalTime = hours * 60 + minutes;

        speechTimings.forEach(timingMinutes => {
          const speechTime = arrivalTime - timingMinutes;

          // 音声案内のタイミングが来たかチェック（2分前から再生可能）
          if (currentTime >= speechTime - 2) {
            // 既に再生済みかチェック
            if (hasBeenPlayed(entry.id, timingMinutes)) {
              return;
            }

            // 既に再生中かチェック
            if (isPlaying || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              return;
            }

            // 音声合成の状態をリセット（念のため）
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.cancel();
            }

            // 同じ便の他のタイミングが既に再生中かチェック
            const currentEntryKey = `${entry.id}-${timingMinutes}分前`;
            if (lastPlayedEntry === currentEntryKey) {
              return;
            }

            const template = monitor.speechFormat ?? appConfig.speechFormat;
            const message = formatSpeech(template, entry);
            if (!message.trim()) {
              return;
            }

            // 音声再生の前後にMP3ファイルを再生
            const playSpeechWithBroadcasting = async () => {
              // 既に音声合成が実行中かチェック
              if (isPlaying || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                return;
              }
            
              // 状態をリセットしてから新しい音声を開始
              setIsPlaying(false);
              setLastPlayedEntry(null);
              
              setIsPlaying(true);
              setLastPlayedEntry(currentEntryKey);
            
              // 放送開始音声を再生
              await playBroadcastingStart();
              
              const utterance = new SpeechSynthesisUtterance(message);
              utterance.rate = monitor.speechRate ?? 1;
              utterance.pitch = monitor.speechPitch ?? 1;
              utterance.lang = monitor.speechLang ?? 'ja-JP';

              utterance.onstart = () => console.log('音声再生開始');
              utterance.onend = async () => {
                // 放送終了音声を再生
                await playBroadcastingEnd();

                // 再生完了記録を保存
                const record = {
                  entryId: entry.id,
                  timingMinutes,
                  playedAt: new Date().toISOString(),
                  arrivalTime: entry.arrivalTime
                };
                savePlaybackRecord(record);

                setIsPlaying(false);
                setLastPlayedEntry(null);
              };
              utterance.onerror = (event) => {
                console.error('音声再生エラー:', event);
                setIsPlaying(false);
                setLastPlayedEntry(null);
              };

              // 既存の音声を停止してから新しい音声を再生
              window.speechSynthesis.cancel();
              
              // 少し待ってから新しい音声を再生（重複実行を防ぐ）
              setTimeout(() => {
                // 再度チェックしてから再生
                if (!isPlaying && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                  window.speechSynthesis.speak(utterance);
                }
              }, 100);
            };

            playSpeechWithBroadcasting();
          }
        });
      });
    }, 30000); // 30秒ごと

    setTimingCheckInterval(interval);

    // クリーンアップ
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [monitor.hasAudio, monitor.speechFormat, monitor.speechRate, monitor.speechPitch, monitor.speechLang, monitor.audioSettings, appConfig.speechFormat, userInteracted, displayEntries, isPlaying, lastPlayedEntry]);

  // リロード時の音声再生
  useEffect(() => {
    checkSpeechSynthesis();

    if (!monitor.hasAudio || !SPEECH_SUPPORTED || !userInteracted) {
      return;
    }
    if (!mainEntries.length) {
      return;
    }

    const target = mainEntries[0];
    if (!target.id) {
      return;
    }

    // 既に再生済みかチェック（リロード時は0分前としてチェック）
    if (hasBeenPlayed(target.id, 0)) {
      return;
    }

    const template = monitor.speechFormat ?? appConfig.speechFormat;
    const message = formatSpeech(template, target);
    
    if (!message.trim()) {
      return;
    }

    // 音声再生の前後にMP3ファイルを再生
    const playSpeechWithBroadcasting = async () => {
      // 放送開始音声を再生
      await playBroadcastingStart();
      
      // 音声合成のイベントリスナーを追加
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = monitor.speechRate ?? 1;
      utterance.pitch = monitor.speechPitch ?? 1;
      utterance.lang = monitor.speechLang ?? 'ja-JP';

      utterance.onstart = () => console.log('音声再生開始');
      utterance.onend = async () => {
        // 放送終了音声を再生
        await playBroadcastingEnd();
        
        // 再生完了記録を保存（リロード時は0分前として記録）
        savePlaybackRecord({
          entryId: target.id,
          timingMinutes: 0,
          playedAt: new Date().toISOString(),
          arrivalTime: target.arrivalTime
        });
      };
      utterance.onerror = (event) => console.error('音声再生エラー:', event);
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    // 少し遅延させてから再生（ブラウザの制限回避）
    setTimeout(playSpeechWithBroadcasting, 100);
  }, [monitor.hasAudio, monitor.speechFormat, monitor.speechRate, monitor.speechPitch, monitor.speechLang, appConfig.speechFormat, mainEntries, userInteracted]);

  return {
    isPlaying,
    lastPlayedEntry
  };
};
