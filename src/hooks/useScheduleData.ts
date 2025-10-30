import { useCallback } from 'react';
import type { AppConfig, MonitorConfig, ScheduleFile } from '../types';
import { fetchAppConfig } from '../services/configService';
import { fetchScheduleData } from '../services/dataService';
import { normalizeEntries, sortEntries, pickDisplayEntries } from '../utils/scheduleNormalizer';

export type LoadResult = {
  latestConfig: AppConfig | null;
  data: ScheduleFile | null;
  displayEntries: ScheduleFile['entries'];
  currentTimeMinutes: number;
};

export const useScheduleData = () => {
  const load = useCallback(async (
    monitor: MonitorConfig,
    appConfig: AppConfig
  ): Promise<LoadResult> => {
    const latestConfig = await fetchAppConfig();
    const effectiveConfig = latestConfig || appConfig;

    const data = await fetchScheduleData(monitor.dataUrl);
    if (!data?.entries) {
      return {
        latestConfig,
        data: null,
        displayEntries: [],
        currentTimeMinutes: new Date().getHours() * 60 + new Date().getMinutes()
      };
    }

    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const beforeMinutes = effectiveConfig.displaySettings?.beforeMinutes ?? 30;

    const normalized = normalizeEntries(data.entries, currentTimeMinutes);
    const sorted = sortEntries(normalized);
    const picked = pickDisplayEntries(sorted, currentTimeMinutes, beforeMinutes);

    // 型的には arrivalDatetime を含むが、元の ScheduleEntry 互換として扱う
    const displayEntries = picked as unknown as ScheduleFile['entries'];

    return { latestConfig, data, displayEntries, currentTimeMinutes };
  }, []);

  return { load };
};


