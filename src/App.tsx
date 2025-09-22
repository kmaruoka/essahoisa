import { useEffect, useMemo, useState } from 'react';
import { ScheduleScreen } from './components/ScheduleScreen';
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
        setError(err instanceof Error ? err.message : '設定ファイルの取得に失敗しました');
        setLoading(false);
      });
  }, []);

  const monitorId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('monitor') ?? config?.defaultMonitorId ?? config?.monitors[0]?.id ?? null;
  }, [config]);

  const monitor: MonitorConfig | undefined = useMemo(() => {
    if (!config || !monitorId) return undefined;
    return config.monitors.find((item) => item.id === monitorId);
  }, [config, monitorId]);

  if (loading) {
    return (
      <div className="screen">
        <div className="placeholder">設定を読み込み中...</div>
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

  if (!config || !monitor) {
    return (
      <div className="screen">
        <div className="placeholder">指定されたモニタIDの設定が見つかりません。</div>
      </div>
    );
  }

  return <ScheduleScreen monitor={monitor} appConfig={config} />;
}
