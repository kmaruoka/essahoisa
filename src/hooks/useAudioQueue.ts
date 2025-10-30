import { useCallback } from 'react';
import type { AppConfig, MonitorConfig, ScheduleFile } from '../types';
import { hasBeenPlayed } from '../utils/audioPlaybackManager';
import { addToGlobalAudioQueue } from '../utils/audioPlaybackState';
import { formatSpeech } from '../utils/formatSpeech';

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const useAudioQueue = () => {
  const enqueueForDisplay = useCallback((
    displayEntries: ScheduleFile['entries'],
    monitor: MonitorConfig,
    config: AppConfig,
    currentTimeMinutes: number,
    isVisible: boolean,
    isLeftSide?: boolean
  ) => {
    if (!monitor.hasAudio || !SPEECH_SUPPORTED || !isVisible) return;

    const monitorConfig = config.monitors.find(m => m.id === monitor.id);
    const audioSettings = monitorConfig?.audioSettings || monitor.audioSettings;
    const speechTimings = audioSettings?.timings ?? [0];

    const audioEntries: Array<{
      entryId: string;
      supplierName: string;
      arrivalTime: string;
      arrivalDatetime: number;
      monitorId: string;
      monitorTitle: string;
      isMainEntry: boolean;
      timing: number;
      speechText: string;
      speechLang: string;
      isLeftSide?: boolean;
    }> = [];

    for (const entry of displayEntries) {
      if (!entry.id || !entry.arrivalTime || !entry.arrivalDatetime) continue;

      const arrivalTime = entry.arrivalDatetime;

      let finishTime: number;
      if (entry.finishTime) {
        const [finishHours, finishMinutes] = entry.finishTime.split(':').map(Number);
        let finishTimeMinutes = finishHours * 60 + finishMinutes;
        if (finishTimeMinutes < currentTimeMinutes) {
          finishTimeMinutes += 24 * 60;
        }
        finishTime = finishTimeMinutes;
      } else {
        finishTime = arrivalTime + 5;
      }

      if (currentTimeMinutes > finishTime) {
        continue;
      }

      const pastTimings = speechTimings.filter(timingMinutes => {
        const speechTime = arrivalTime - timingMinutes;
        return currentTimeMinutes >= speechTime;
      });
      if (pastTimings.length === 0) continue;

      const sortedPastTimings = [...pastTimings].sort((a, b) => a - b);
      let targetTiming: number | null = null;
      for (const timingMinutes of sortedPastTimings) {
        const played = hasBeenPlayed(entry.id, timingMinutes);
        if (!played) {
          targetTiming = timingMinutes;
          break;
        }
      }
      if (targetTiming === null) continue;

      const isMainEntry = displayEntries.indexOf(entry) === 0;
      const speechText = formatSpeech(config.speechFormat, entry);

      audioEntries.push({
        entryId: entry.id,
        supplierName: entry.supplierName,
        arrivalTime: entry.arrivalTime || '',
        arrivalDatetime: entry.arrivalDatetime,
        monitorId: monitor.id,
        monitorTitle: monitor.title,
        isMainEntry,
        timing: targetTiming,
        speechText,
        speechLang: monitor.speechLang || 'ja-JP',
        isLeftSide
      });
    }

    for (const audioEntry of audioEntries) {
      addToGlobalAudioQueue(audioEntry);
    }
  }, []);

  return { enqueueForDisplay };
};


