import { useEffect, useMemo, useState } from 'react';
import { useScheduleData } from '../hooks/useScheduleData';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';
import { Container, Row, Col } from 'react-bootstrap';
import { useAudioPlayback } from '../hooks/useAudioPlayback';

interface SplitScheduleScreenProps {
  leftMonitor: MonitorConfig;
  rightMonitor: MonitorConfig;
  appConfig: AppConfig;
}

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// 単一のモニター用のコンポーネント
const SingleMonitorDisplay = ({ 
  monitor, 
  appConfig, 
  isLeft = true 
}: { 
  monitor: MonitorConfig; 
  appConfig: AppConfig; 
  isLeft?: boolean;
}) => {
  const refreshIntervalMs = useMemo(() => {
    const intervalSeconds = monitor.refreshIntervalSeconds ?? appConfig.pollingIntervalSeconds ?? 30;
    return intervalSeconds * 1000;
  }, [monitor.refreshIntervalSeconds, appConfig.pollingIntervalSeconds]);

  const { data, loading, error } = useScheduleData({
    url: monitor.dataUrl,
    refreshIntervalMs,
  });

  const entries = useMemo(() => {
    if (!data?.entries) return [];
    
    // arrivalTimeで昇順ソート
    return [...data.entries].sort((a, b) => {
      if (!a.arrivalTime || !b.arrivalTime) return 0;
      
      const [aHours, aMinutes] = a.arrivalTime.split(':').map(Number);
      const [bHours, bMinutes] = b.arrivalTime.split(':').map(Number);
      
      const aTime = aHours * 60 + aMinutes;
      const bTime = bHours * 60 + bMinutes;
      
      return aTime - bTime;
    });
  }, [data]);
  
  // 現在時刻から最も近い未来の2件を取得
  const displayEntries = useMemo(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // 分単位で現在時刻を取得
    
    // 現在時刻から最も近い未来の便を2件取得
    const futureEntries = entries.filter(entry => {
      if (!entry.arrivalTime) return false;
      
      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      
      return arrivalTime >= currentTime;
    });

    // 現在時刻以降の便が2件以上ある場合は、そのまま2件を返す
    if (futureEntries.length >= 2) {
      return futureEntries.slice(0, 2);
    }

    // 現在時刻以降の便が1件の場合は、翌日の最初の便を追加
    if (futureEntries.length === 1) {
      const nextDayEntry = entries.find(entry => {
        if (!entry.arrivalTime) return false;
        const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
        const arrivalTime = hours * 60 + minutes;
        return arrivalTime < currentTime;
      });
      return nextDayEntry ? [futureEntries[0], nextDayEntry] : futureEntries;
    }

    // 現在時刻以降の便がない場合は、翌日の最初の2件を返す
    const nextDayEntries = entries.filter(entry => {
      if (!entry.arrivalTime) return false;
      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      return arrivalTime < currentTime;
    });
    
    return nextDayEntries.slice(0, 2);
  }, [entries]);
  
  // 上段（メイン表示）
  const mainEntries = displayEntries.slice(0, 1);
  
  // 下段（次の便）
  const nextEntry = displayEntries[1];

  const [userInteracted, setUserInteracted] = useState(false);
  const [autoEnableFailed, setAutoEnableFailed] = useState(false);

  // 音声再生フックを使用
  useAudioPlayback({
    monitor,
    appConfig,
    displayEntries,
    mainEntries,
    userInteracted,
    isLeft
  });

  // ユーザーインタラクション検知と自動有効化の試行
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
    };

    // 自動有効化の試行（ブラウザによっては動作する場合がある）
    const tryAutoEnable = () => {
      if (monitor.hasAudio && SPEECH_SUPPORTED) {
        // 無音の音声を再生してAPIを有効化
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        silentUtterance.onstart = () => {
          console.log('音声API自動有効化成功');
          setUserInteracted(true);
        };
        silentUtterance.onerror = () => {
          console.log('音声API自動有効化失敗 - ユーザーインタラクションが必要');
          setAutoEnableFailed(true);
        };
        
        try {
          window.speechSynthesis.speak(silentUtterance);
        } catch (e) {
          console.log('音声API自動有効化エラー:', e);
          setAutoEnableFailed(true);
        }
      }
    };

    // ページロード後少し遅延してから自動有効化を試行
    const timer = setTimeout(tryAutoEnable, 1000);

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [monitor.hasAudio, SPEECH_SUPPORTED]);



  return (
    <Container fluid className={`screen split-screen ${isLeft ? 'left-panel' : 'right-panel'}`}>
      <Row className="header">
        <Col className="header-title">{monitor.title}</Col>
        {!SPEECH_SUPPORTED && monitor.hasAudio && (
          <Col className="header-note">※ このブラウザーでは音声合成が利用できません。</Col>
        )}
        {SPEECH_SUPPORTED && monitor.hasAudio && !userInteracted && autoEnableFailed && (
          <Col className="header-note">
            <button 
              className="audio-enable-button"
              onClick={() => setUserInteracted(true)}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-small)'
              }}
            >
              🔊 音声案内を有効にする
            </button>
          </Col>
        )}
      </Row>
      <Row className="main align-items-center" style={{ minHeight: '50vh' }}>
        <Col>
          {loading && <div className="placeholder">データを読み込み中...</div>}
          {!loading && error && <div className="placeholder">{error}</div>}
          {!loading && !error && mainEntries.length === 0 && <div className="placeholder">データがありません</div>}
          {!loading && !error && mainEntries.map((entry) => <ScheduleRow key={entry.id} entry={entry} variant="primary" isSplitView={true} />)}
        </Col>
      </Row>
      <Row className="divider" style={{ flexShrink: 0 }} />
      <Row className="footer align-items-center" style={{ minHeight: '30vh' }}>
        <Col>
          <Row className="footer-inner">
            <Col>
              {nextEntry ? (
                <ScheduleRow entry={nextEntry} variant="secondary" isSplitView={true} showNextIndicator={true} />
              ) : (
                <div className="placeholder">次の入線予定はありません</div>
              )}
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export const SplitScheduleScreen = ({ leftMonitor, rightMonitor, appConfig }: SplitScheduleScreenProps) => {
  return (
    <Container fluid className="split-screen-container">
      <Row className="split-screen-row">
        <Col lg={6} md={12} className="split-panel">
          <SingleMonitorDisplay 
            monitor={leftMonitor} 
            appConfig={appConfig} 
            isLeft={true}
          />
        </Col>
        <Col lg={6} md={12} className="split-panel">
          <SingleMonitorDisplay 
            monitor={rightMonitor} 
            appConfig={appConfig} 
            isLeft={false}
          />
        </Col>
      </Row>
    </Container>
  );
};
