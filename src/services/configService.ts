import type { AppConfig } from '../types';
import { buildConfigUrl } from '../utils/configUtils';

export const fetchAppConfig = async (): Promise<AppConfig | null> => {
  try {
    const configUrl = buildConfigUrl();
    const response = await fetch(configUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`設定ファイルの取得に失敗しました (${response.status})`);
    }
    const config = await response.json() as AppConfig;
    return config;
  } catch (err: unknown) {
    console.error('設定取得エラー:', err);
    return null;
  }
};


