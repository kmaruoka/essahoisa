import type { ScheduleEntry } from '../types';

export type NormalizedEntry = ScheduleEntry & { arrivalDatetime: number | null };

export const normalizeEntries = (
  entries: ScheduleEntry[],
  currentTimeMinutes: number
): NormalizedEntry[] => {
  return entries
    .map(entry => {
      if (!entry.arrivalTime) return { ...entry, arrivalDatetime: null };

      const [arrivalHours, arrivalMinutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = arrivalHours * 60 + arrivalMinutes;

      let finishTime: number;
      if (entry.finishTime) {
        const [finishHours, finishMinutes] = entry.finishTime.split(':').map(Number);
        finishTime = finishHours * 60 + finishMinutes;
      } else {
        finishTime = arrivalTime + 5;
      }

      const isNextDay = finishTime < currentTimeMinutes;
      const arrivalDatetime = isNextDay ? arrivalTime + 24 * 60 : arrivalTime;

      return { ...entry, arrivalDatetime };
    })
    .filter(entry => entry.arrivalDatetime !== null);
};

export const sortEntries = (entries: NormalizedEntry[]): NormalizedEntry[] => {
  return [...entries].sort((a, b) => {
    if (a.arrivalDatetime === null || b.arrivalDatetime === null) return 0;
    if (a.arrivalDatetime !== b.arrivalDatetime) {
      return a.arrivalDatetime - b.arrivalDatetime;
    }
    const aOrder = parseInt(a.order || '0', 10);
    const bOrder = parseInt(b.order || '0', 10);
    return aOrder - bOrder;
  });
};

export const pickDisplayEntries = (
  entries: NormalizedEntry[],
  currentTimeMinutes: number,
  beforeMinutes: number,
  limit: number = 2
): NormalizedEntry[] => {
  return entries
    .filter(entry => {
      if (!entry.arrivalDatetime) return false;
      const showStartTime = entry.arrivalDatetime - beforeMinutes;
      return currentTimeMinutes >= showStartTime;
    })
    .slice(0, limit);
};


