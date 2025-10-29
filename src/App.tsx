import { useEffect } from 'react';
import { ScheduleBoard } from './components/ScheduleBoard';
import { SplitScheduleBoard } from './components/SplitScheduleBoard';
import { useUrlParams } from './hooks/useUrlParams';

export default function App() {
  const { isSplitView, monitor, leftMonitor, rightMonitor } = useUrlParams();

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


  // 左右分割表示の場合
  if (isSplitView) {
    if (!leftMonitor || !rightMonitor) {
      return (
        <div className="screen">
          <div className="placeholder">モニタ設定が見つかりません。</div>
        </div>
      );
    }
    return <SplitScheduleBoard leftMonitor={leftMonitor} rightMonitor={rightMonitor} />;
  }

  // 通常の単一表示の場合
  if (!monitor) {
    return (
      <div className="screen">
        <div className="placeholder">指定されたモニタIDの設定が見つかりません。</div>
      </div>
    );
  }

  return <ScheduleBoard monitor={monitor} />;
}
