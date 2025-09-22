import type { ScheduleEntry } from '../types';

const PLACEHOLDER_MAP: Record<string, (entry: ScheduleEntry) => string | undefined> = {
  supplierName: (entry) => entry.supplierName,
  supplierReading: (entry) => entry.supplierReading,
  materialReading: (entry) => entry.materialReading,
  arrivalTime: (entry) => entry.arrivalTime,
  finishTime: (entry) => entry.finishTime,
  lane: (entry) => entry.lane,
  preparation: (entry) => entry.preparation,
  yard: (entry) => entry.yard,
  note: (entry) => entry.note,
};

export const formatSpeech = (template: string, entry: ScheduleEntry): string => {
  return Object.entries(PLACEHOLDER_MAP).reduce((acc, [key, getter]) => {
    const value = getter(entry);
    return acc.replace(new RegExp(`{${key}}`, 'g'), value ?? '');
  }, template);
};
