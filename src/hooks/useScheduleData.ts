import { useCallback } from 'react';
import type { AppConfig, MonitorConfig, ScheduleFile } from '../types';
import { fetchAppConfig } from '../services/configService';
import { fetchScheduleData } from '../services/dataService';
import { normalizeEntries, sortEntries, pickDisplayEntries } from '../utils/scheduleNormalizer';

export type LoadResult = {
  latestConfig: AppConfig | null;
  selectedMonitor: MonitorConfig | null;
  data: ScheduleFile | null;
  displayEntries: ScheduleFile['entries'];
  currentTimeMinutes: number;
};

export const useScheduleData = () => {
  const load = useCallback(async (
    monitorId: string
  ): Promise<LoadResult> => {
    const latestConfig = await fetchAppConfig();

    if (!latestConfig) {
      return {
        latestConfig: null,
        selectedMonitor: null,
        data: null,
        displayEntries: [],
        currentTimeMinutes: new Date().getHours() * 60 + new Date().getMinutes()
      };
    }

    const selectedMonitor = latestConfig.monitors.find(m => m.id === monitorId) || null;
    if (!selectedMonitor) {
      return {
        latestConfig,
        selectedMonitor: null,
        data: null,
        displayEntries: [],
        currentTimeMinutes: new Date().getHours() * 60 + new Date().getMinutes()
      };
    }

    const data = await fetchScheduleData(selectedMonitor.dataUrl);
    if (!data?.entries) {
      return {
        latestConfig,
        selectedMonitor,
        data: null,
        displayEntries: [],
        currentTimeMinutes: new Date().getHours() * 60 + new Date().getMinutes()
      };
    }

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


