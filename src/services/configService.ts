import type { AppConfig } from '../types';
import { buildConfigUrl } from '../utils/configUtils';

export const fetchAppConfig = async (): Promise<AppConfig> => {
  const configUrl = buildConfigUrl();
  const response = await fetch(configUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`設定ファイルの取得に失敗しました (${response.status})`);
  }
  try {
    const config = await response.json() as AppConfig;
    return config;
  } catch {
    throw new Error('設定ファイルの解析に失敗しました');
  }
};


