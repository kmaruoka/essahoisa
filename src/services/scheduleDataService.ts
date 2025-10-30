import type { ScheduleFile } from '../types';

export const fetchScheduleData = async (dataUrl: string): Promise<ScheduleFile> => {
  const response = await fetch(dataUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`発車データファイルの取得に失敗しました (${response.status})`);
  }
  try {
    const json = await response.json() as ScheduleFile;
    return json;
  } catch {
    throw new Error('発車データファイルの解析に失敗しました');
  }
};
