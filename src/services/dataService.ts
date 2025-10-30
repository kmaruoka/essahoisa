import type { ScheduleFile } from '../types';

export const fetchScheduleData = async (dataUrl: string): Promise<ScheduleFile | null> => {
  try {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`データの取得に失敗しました (${response.status})`);
    }
    const json = await response.json() as ScheduleFile;
    return json;
  } catch (err: unknown) {
    console.error('データ取得エラー:', err);
    return null;
  }
};


