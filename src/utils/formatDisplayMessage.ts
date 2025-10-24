import type { AppConfig } from '../types';

/**
 * 表示メッセージのプレースホルダを置換する共通関数
 * @param config アプリケーション設定
 * @returns プレースホルダが置換されたメッセージ
 */
export const formatDisplayMessage = (
  config: AppConfig
): string => {
  const message = config.displaySettings?.emptyTimeMessage ?? "";
  
  if (config.displaySettings?.beforeMinutes) {
    return message.replace("{beforeMinutes}", config.displaySettings.beforeMinutes.toString());
  }
  
  return message;
};
