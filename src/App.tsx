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
  console.log('App コンポーネント実行開始');
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
      } catch (error) {
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
    console.log('設定ファイルURL:', url);
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        console.log('設定ファイルレスポンス:', response.status);
        if (!response.ok) {
          throw new Error(`設定ファイルの取得に失敗しました (${response.status})`);
        }
        return (await response.json()) as AppConfig;
      })
      .then((json) => {
        console.log('設定ファイル取得成功:', json);
        setConfig(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('設定ファイル取得エラー:', err);
        setError(err instanceof Error ? err.message : '設定ファイルの取得に失敗しました');
        setLoading(false);
      });
  }, []);

  const monitorId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('monitor') ?? config?.defaultMonitorId ?? config?.monitors[0]?.id ?? null;
  }, [config]);

  const isSplitView = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('split') === 'true';
  }, []);

  const monitor: MonitorConfig | undefined = useMemo(() => {
    console.log('monitor useMemo 実行:', { config, monitorId });
    if (!config || !monitorId) return undefined;
    const found = config.monitors.find((item) => item.id === monitorId);
    console.log('見つかったmonitor:', found);
    return found;
  }, [config, monitorId]);

  const leftMonitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || !isSplitView) return undefined;
    const params = new URLSearchParams(window.location.search);
    const leftId = params.get('left') ?? config?.monitors[0]?.id ?? null;
    if (!leftId) return undefined;
    return config.monitors.find((item) => item.id === leftId);
  }, [config, isSplitView]);

  const rightMonitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || !isSplitView) return undefined;
    const params = new URLSearchParams(window.location.search);
    const rightId = params.get('right') ?? config?.monitors[1]?.id ?? null;
    if (!rightId) return undefined;
    return config.monitors.find((item) => item.id === rightId);
  }, [config, isSplitView]);

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
          <div className="placeholder">
            左右分割表示用のモニタ設定が見つかりません。
            {!leftMonitor && <div>左側のモニタが見つかりません。</div>}
            {!rightMonitor && <div>右側のモニタが見つかりません。</div>}
          </div>
        </div>
      );
    }

    console.log('SplitScheduleScreen をレンダリング:', { leftMonitor, rightMonitor, config });
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

  console.log('ScheduleScreen をレンダリング:', { monitor, config });
  return <ScheduleScreen monitor={monitor} appConfig={config} />;
}
