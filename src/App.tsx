import { useEffect, useMemo, useState } from 'react';
import { ScheduleScreen } from './components/ScheduleScreen';
import { SplitScheduleScreen } from './components/SplitScheduleScreen';
import type { AppConfig, MonitorConfig } from './types';

const buildConfigUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'config/monitor-config.json';
  }
  const base = window.location.href.split(/[?#]/)[0];
  const lastSlash = base.lastIndexOf('/');
  const lastSegment = lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
  const hasExtension = lastSegment.includes('.');
  const normalized = hasExtension
    ? base.slice(0, lastSlash + 1)
    : `${base}${base.endsWith('/') ? '' : '/'}`;
  return `${normalized}config/monitor-config.json`;
};

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // 全画面表示の機能
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        console.log('全画面表示が拒否されました');
      }
    };

    const handleClick = () => {
      requestFullscreen();
      document.removeEventListener('click', handleClick);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);



  useEffect(() => {
    const url = buildConfigUrl();
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`設定ファイルの取得に失敗しました (${response.status})`);
        }
        return (await response.json()) as AppConfig;
      })
      .then((json) => {
        setConfig(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('設定ファイル取得エラー:', err);
        setError(err instanceof Error ? err.message : '設定ファイルの取得に失敗しました');
        setLoading(false);
      });
  }, []);

  // URLパラメータからmonitorのIDを取得（複数指定可能）
  const monitorIds = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const monitorParams = params.getAll('monitor');
    
    // monitorパラメータが指定されていない場合はデフォルトを使用
    if (monitorParams.length === 0) {
      return [config?.defaultMonitorId ?? config?.monitors[0]?.id ?? null].filter(Boolean);
    }
    
    return monitorParams.filter(Boolean);
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

  if (loading) {
    return (
      <div className="screen">
        <div className="placeholder">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen">
        <div className="placeholder">{error}</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="screen">
        <div className="placeholder">設定が見つかりません。</div>
      </div>
    );
  }

  // 左右分割表示の場合
  if (isSplitView) {
    if (!leftMonitor || !rightMonitor) {
      return (
        <div className="screen">
          <div className="placeholder">モニタ設定が見つかりません。</div>
        </div>
      );
    }
    return <SplitScheduleScreen leftMonitor={leftMonitor} rightMonitor={rightMonitor} appConfig={config} />;
  }

  // 通常の単一表示の場合
  if (!monitor) {
    return (
      <div className="screen">
        <div className="placeholder">指定されたモニタIDの設定が見つかりません。</div>
      </div>
    );
  }

  return <ScheduleScreen monitor={monitor} appConfig={config} />;
}
