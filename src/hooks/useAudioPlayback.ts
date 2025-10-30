import { useMemo } from 'react';
import { AudioService, SpeechOptions } from '../services/audioService';

export interface AudioQueueItem {
  speechText: string;
  speechLang: string;
}

export const useAudioPlayback = () => {
  const audioService = useMemo(() => new AudioService(), []);

  const playAudio = async (item: AudioQueueItem) => {
    await audioService.playChime('start');
    const options: SpeechOptions = {
      lang: item.speechLang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    };
    await audioService.speakText(item.speechText, options);
    await audioService.playChime('end');
  };

  return { playAudio };
};


