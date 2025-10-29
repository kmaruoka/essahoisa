import { useMemo } from 'react';
import type { MonitorConfig } from '../types';
import { useConfig } from './usePolling';

interface UseUrlParamsResult {
  monitorIds: string[];
  isSplitView: boolean;
  monitor: MonitorConfig | undefined;
  leftMonitor: MonitorConfig | undefined;
  rightMonitor: MonitorConfig | undefined;
}

export const useUrlParams = (): UseUrlParamsResult => {
  const { config } = useConfig();
  // URLパラメータからmonitorのIDを取得（複数指定可能）
  const monitorIds = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const monitorParams = params.getAll('monitor');
    
    // monitorパラメータが指定されていない場合はデフォルトを使用
    if (monitorParams.length === 0) {
      return [config?.defaultMonitorId ?? config?.monitors[0]?.id ?? null].filter(Boolean) as string[];
    }
    
    return monitorParams.filter(Boolean) as string[];
  }, [config]);

  // 分割表示かどうかを判定（monitorパラメータが2つ以上の場合）
  const isSplitView = useMemo(() => {
    return monitorIds.length >= 2;
  }, [monitorIds]);

  // 単一表示用のmonitor
  const monitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || isSplitView || monitorIds.length !== 1) return undefined;
    const monitorId = monitorIds[0];
    return config.monitors.find((item) => item.id === monitorId);
  }, [config, monitorIds, isSplitView]);

  // 分割表示用の左側monitor（最初のmonitorパラメータ）
  const leftMonitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || !isSplitView || monitorIds.length < 1) return undefined;
    const leftId = monitorIds[0];
    return config.monitors.find((item) => item.id === leftId);
  }, [config, monitorIds, isSplitView]);

  // 分割表示用の右側monitor（2番目のmonitorパラメータ）
  const rightMonitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || !isSplitView || monitorIds.length < 2) return undefined;
    const rightId = monitorIds[1];
    return config.monitors.find((item) => item.id === rightId);
  }, [config, monitorIds, isSplitView]);

  return {
    monitorIds,
    isSplitView,
    monitor,
    leftMonitor,
    rightMonitor
  };
};
