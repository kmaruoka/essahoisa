import { useEffect, useMemo, useState } from 'react';
import { useSimplePolling } from '../hooks/useSimplePolling';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';
import { formatDisplayMessage } from '../utils/formatDisplayMessage';
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
  // シンプルポーリングを使用（全てのロジックが統合されている）
  const { startPolling, data, loading, error, currentConfig, currentMonitor, displayEntries } = useSimplePolling(monitor, appConfig);
  
  // 最新の設定を使用（ポーリングで更新された設定を優先）
  const effectiveConfig = currentConfig || appConfig;
  const effectiveMonitor = currentMonitor || monitor;

  // ポーリング開始
  useEffect(() => {
    const stopPolling = startPolling();
    return stopPolling;
  }, []); // 依存配列を空にして、初回のみ実行
  
  // 上段（メイン表示）
  const mainEntries = displayEntries.slice(0, 1);
  
  // 下段（次の便）
  const nextEntry = displayEntries[1];

  // 音声API自動有効化（ユーザーインタラクション不要）
  useEffect(() => {
    if (effectiveMonitor.hasAudio && SPEECH_SUPPORTED) {
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
  }, [effectiveMonitor.hasAudio]);



  return (
    <Container fluid className={`screen split-screen ${isLeft ? 'left-panel' : 'right-panel'}`}>
      <Row className="header">
        <Col className="header-title">{effectiveMonitor.title}</Col>
        {!SPEECH_SUPPORTED && effectiveMonitor.hasAudio && (
          <Col className="header-note">※ このブラウザーでは音声合成が利用できません。</Col>
        )}
      </Row>
      <Row className="main align-items-center" style={{ minHeight: '50vh' }}>
        <Col>
          {loading && <div className="placeholder">データを読み込み中...</div>}
          {!loading && error && <div className="placeholder">{error}</div>}
          {!loading && !error && mainEntries.length === 0 && (
            <div className="placeholder">
              {formatDisplayMessage(effectiveConfig)}
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
                  {formatDisplayMessage(effectiveConfig)}
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
