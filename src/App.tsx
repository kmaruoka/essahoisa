import { useEffect } from 'react';
import { ScheduleScreen } from './components/ScheduleScreen';
import { SplitScheduleScreen } from './components/SplitScheduleScreen';
import { useConfig } from './hooks/usePolling';
import { useUrlParams } from './hooks/useUrlParams';

export default function App() {
  const { config, loading, error } = useConfig();
  const { isSplitView, monitor, leftMonitor, rightMonitor } = useUrlParams(config);

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
