import { useEffect, useMemo, useState } from 'react';
import { useSimplePolling } from '../hooks/useSimplePolling';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';
import { Container, Row, Col } from 'react-bootstrap';

interface SplitScheduleScreenProps {
  leftMonitor: MonitorConfig;
  rightMonitor: MonitorConfig;
  appConfig: AppConfig;
}

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// エラーモニタ用のコンポーネント
const ErrorMonitorDisplay = ({ 
  errorMessage, 
  isLeft = true,
  appConfig
}: { 
  errorMessage: string; 
  isLeft?: boolean;
  appConfig: AppConfig;
}) => {

  return (
    <Container fluid className={`screen split-screen ${isLeft ? 'left-panel' : 'right-panel'}`}>
      <Row className="header">
        <Col className="header-title">エラー</Col>
      </Row>
      <Row className="main align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Col>
          <div className="placeholder">{errorMessage}</div>
        </Col>
      </Row>
    </Container>
  );
};

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
  // シンプルポーリングを使用（データ取得と音声チェックを統合）
  const { startPolling, data, loading, error } = useSimplePolling(monitor, appConfig);

  // ポーリング開始
  useEffect(() => {
    const stopPolling = startPolling();
    return stopPolling;
  }, [startPolling]);

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
    
    // 設定から表示開始時間を取得（デフォルト30分前）
    const showBeforeMinutes = appConfig.displaySettings?.showBeforeMinutes ?? 30;
    
    // 現在時刻以降の便を取得
    const futureEntries = entries.filter(entry => {
      if (!entry.arrivalTime) return false;
      
      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      
      // 現在時刻以降の便のみを対象とする
      const isAfterCurrentTime = arrivalTime >= currentTime;
      
      // 到着予定時刻がshowBeforeMinutes分以内の便のみを表示
      const timeDiff = arrivalTime - currentTime;
      const shouldShow = isAfterCurrentTime && timeDiff <= showBeforeMinutes;
      
      return shouldShow;
    });

    // 表示対象の便が2件以上ある場合は、そのまま2件を返す
    if (futureEntries.length >= 2) {
      return futureEntries.slice(0, 2);
    }

    // 表示対象の便が1件の場合は、その便のみを返す
    if (futureEntries.length === 1) {
      return [futureEntries[0]];
    }

    // 表示対象の便がない場合は空配列を返す（emptyTimeMessageを表示する）
    return [];
  }, [entries, appConfig.displaySettings]);
  
  // 上段（メイン表示）
  const mainEntries = displayEntries.slice(0, 1);
  
  // 下段（次の便）
  const nextEntry = displayEntries[1];

  // 音声API自動有効化（ユーザーインタラクション不要）
  useEffect(() => {
    if (monitor.hasAudio && SPEECH_SUPPORTED) {
      console.log('音声API自動有効化開始');
      // 無音の音声を再生してAPIを有効化
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      silentUtterance.onstart = () => {
        console.log('音声API自動有効化成功');
      };
      silentUtterance.onerror = () => {
        console.log('音声API自動有効化失敗');
      };
      
      try {
        window.speechSynthesis.speak(silentUtterance);
      } catch (e) {
        console.log('音声API自動有効化エラー:', e);
      }
    }
  }, [monitor.hasAudio]);



  return (
    <Container fluid className={`screen split-screen ${isLeft ? 'left-panel' : 'right-panel'}`}>
      <Row className="header">
        <Col className="header-title">{monitor.title}</Col>
        {!SPEECH_SUPPORTED && monitor.hasAudio && (
          <Col className="header-note">※ このブラウザーでは音声合成が利用できません。</Col>
        )}
      </Row>
      <Row className="main align-items-center" style={{ minHeight: '50vh' }}>
        <Col>
          {loading && <div className="placeholder">データを読み込み中...</div>}
          {!loading && error && <div className="placeholder">{error}</div>}
          {!loading && !error && mainEntries.length === 0 && (
            <div className="placeholder">
              {appConfig.displaySettings?.emptyTimeMessage ?? "入線予定はありません"}
            </div>
          )}
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
                <div className="placeholder">
                  {appConfig.displaySettings?.emptyTimeMessage ?? "入線予定はありません"}
                </div>
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
          {leftMonitor ? (
            <SingleMonitorDisplay 
              monitor={leftMonitor} 
              appConfig={appConfig} 
              isLeft={true}
            />
          ) : (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={true}
              appConfig={appConfig}
            />
          )}
        </Col>
        <Col lg={6} md={12} className="split-panel">
          {rightMonitor ? (
            <SingleMonitorDisplay 
              monitor={rightMonitor} 
              appConfig={appConfig} 
              isLeft={false}
            />
          ) : (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={false}
              appConfig={appConfig}
            />
          )}
        </Col>
      </Row>
    </Container>
  );
};
