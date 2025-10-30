import { useCallback } from 'react';
import type { AppConfig, MonitorConfig, ScheduleFile, ScheduleEntry } from '../types';
import { fetchAppConfig } from '../services/configService';
import { fetchScheduleData } from '../services/scheduleDataService';
import { normalizeEntries, sortEntries, pickDisplayEntries } from '../utils/scheduleNormalizer';

export type LoadResult = {
  latestConfig: AppConfig;
  selectedMonitor: MonitorConfig;
  data: ScheduleFile;
  displayEntries: ScheduleFile['entries'];
  currentTimeMinutes: number;
};

const assertString = (val: unknown, name: string) => {
  if (typeof val !== 'string') throw new Error(`${name} が不正です`);
};

const validateScheduleEntries = (entries: ScheduleEntry[]) => {
  if (!Array.isArray(entries)) throw new Error('entries が不正です');
  for (const e of entries) {
    assertString(e.id, 'id');
    assertString(e.arrivalTime, 'arrivalTime');
    assertString(e.supplierName, 'supplierName');
    // 空許容: note, preparation, yard, lane は空文字可（型が文字列なら可）
    if (e.note !== undefined && typeof e.note !== 'string') throw new Error('note が不正です');
    if (e.preparation !== undefined && typeof e.preparation !== 'string') throw new Error('preparation が不正です');
    if (e.yard !== undefined && typeof e.yard !== 'string') throw new Error('yard が不正です');
    if (e.lane !== undefined && typeof e.lane !== 'string') throw new Error('lane が不正です');
  }
};

export const useScheduleData = () => {
  const load = useCallback(async (
    monitorId: string
  ): Promise<LoadResult> => {
    const latestConfig = await fetchAppConfig();
    if (!latestConfig?.monitors || !Array.isArray(latestConfig.monitors) || latestConfig.monitors.length === 0) {
      throw new Error('設定ファイルにモニター情報がありません');
    }
    if (typeof latestConfig.speechFormat !== 'string') {
      throw new Error('設定ファイルの speechFormat が不正です');
    }

    const selectedMonitor = latestConfig.monitors.find(m => m.id === monitorId);
    if (!selectedMonitor) {
      throw new Error('指定されたモニター設定が見つかりません');
    }

    const data = await fetchScheduleData(selectedMonitor.dataUrl);
    if (!data?.entries) {
      throw new Error('データファイルの entries が見つかりません');
    }
    validateScheduleEntries(data.entries);

    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const beforeMinutes = latestConfig.displaySettings?.beforeMinutes ?? 30;

    const normalized = normalizeEntries(data.entries, currentTimeMinutes);
    const sorted = sortEntries(normalized);
    const picked = pickDisplayEntries(sorted, currentTimeMinutes, beforeMinutes);
    const displayEntries = picked as unknown as ScheduleFile['entries'];

    return { latestConfig, selectedMonitor, data, displayEntries, currentTimeMinutes };
  }, []);

  return { load };
};


