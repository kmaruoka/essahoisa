import { logger } from '../utils/logger';

export type ChimeType = 'start' | 'end';

export interface SpeechOptions {
  lang: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class AudioService {
  async fetchAudioSettings(monitorId: string): Promise<number[]> {
    try {
      const response = await fetch('/config/app-config.json', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error(`設定取得失敗: ${response.status}`);
      }
      const config = await response.json();
      const monitor = config.monitors?.find((m: { id: string; audioSettings?: { timings?: number[] } }) => m.id === monitorId);
      const timings: number[] | undefined = monitor?.audioSettings?.timings?.map((t: number) => Number(t));
      return Array.isArray(timings) && timings.length > 0 ? timings : [];
    } catch (error) {
      logger.error('設定ファイルの取得に失敗:', error);
      return [];
    }
  }

  async playChime(type: ChimeType): Promise<void> {
    const src = type === 'start' ? '/data/broadcasting-start1.mp3' : '/data/broadcasting-end1.mp3';
    return new Promise((resolve, reject) => {
      const audio = new Audio(src);
      audio.onended = () => resolve();
      audio.onerror = (error) => {
        logger.error(`${type} チャイム再生エラー:`, error);
        reject(error);
      };
      audio.play().catch((playError) => {
        logger.error(`${type} チャイム再生開始エラー:`, playError);
        reject(playError);
      });
    });
  }

  async speakText(text: string, options: SpeechOptions): Promise<void> {
    if (!('speechSynthesis' in window)) {
      throw new Error('音声合成がサポートされていません');
    }

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch {
      // AudioContext 確認エラーは無視
    }

    window.speechSynthesis.cancel();
    await new Promise((r) => setTimeout(r, 100));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang;
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(voice => voice.lang.startsWith('ja') && voice.name.includes('Japanese'))
      || voices.find(voice => voice.lang === 'ja-JP');
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    while (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    await new Promise<void>((resolve, reject) => {
      let isResolved = false;
      utterance.onend = () => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      };
      utterance.onerror = (error) => {
        if (!isResolved) {
          logger.error('音声合成エラー:', error);
          isResolved = true;
          reject(new Error('音声合成エラー: ' + (error as unknown as { error?: string })?.error));
        }
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        logger.error('音声合成開始エラー:', error);
        if (!isResolved) {
          isResolved = true;
          reject(new Error('音声合成開始エラー: ' + error));
        }
      }
    });
  }
}


