import { useEffect, useMemo, useState } from 'react';
import { useSimplePolling } from '../hooks/useSimplePolling';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';
import { formatDisplayMessage } from '../utils/formatDisplayMessage';
import { Container, Row, Col } from 'react-bootstrap';

interface ScheduleScreenProps {
  monitor: MonitorConfig;
  appConfig: AppConfig;
  isSplitView?: boolean;
  leftMonitor?: MonitorConfig;
  rightMonitor?: MonitorConfig;
}

const toDisplayTime = (isoString?: string): string | undefined => {
  if (!isoString) return undefined;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const datePart = `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, '0')}/${`${date.getDate()}`.padStart(2, '0')}`;
  const timePart = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
};

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const ScheduleScreen = ({ monitor, appConfig }: ScheduleScreenProps) => {
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
    <Container fluid className="screen">
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
          {!loading && !error && mainEntries.map((entry) => <ScheduleRow key={entry.id} entry={entry} variant="primary" />)}
        </Col>
      </Row>
      <Row className="divider" style={{ flexShrink: 0 }} />
      <Row className="footer align-items-center" style={{ minHeight: '30vh' }}>
        <Col>
          <Row className="footer-inner">
            <Col xs="auto" className="next-indicator">次</Col>
            <Col>
              {loading && <div className="placeholder">データを読み込み中...</div>}
              {!loading && error && <div className="placeholder">{error}</div>}
              {!loading && !error && !nextEntry && (
                <div className="placeholder">
                  {formatDisplayMessage(effectiveConfig)}
                </div>
              )}
              {!loading && !error && nextEntry && <ScheduleRow entry={nextEntry} variant="secondary" />}
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};
