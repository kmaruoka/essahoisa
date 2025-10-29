import { Container, Row, Col } from 'react-bootstrap';
import { SchedulePane } from './SchedulePane';
import { formatDisplayMessage } from '../utils/formatDisplayMessage';
import { useScheduleBoard } from '../hooks/useScheduleBoard';
import { useConfig } from '../hooks/usePolling';
import type { MonitorConfig } from '../types';

interface ScheduleBoardProps {
  monitor: MonitorConfig;
  isSplitView?: boolean;
  isLeft?: boolean;
}

export const ScheduleBoard = ({ 
  monitor, 
  isSplitView = false,
  isLeft = true
}: ScheduleBoardProps) => {
  const { config, loading: configLoading, error: configError } = useConfig();
  
  if (configLoading) {
    return (
      <div className="screen">
        <div className="placeholder">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="screen">
        <div className="placeholder">{configError || '設定が見つかりません。'}</div>
      </div>
    );
  }

  const { 
    loading, 
    error, 
    effectiveConfig, 
    effectiveMonitor, 
    primaryEntry, 
    secondaryEntry, 
    SPEECH_SUPPORTED 
  } = useScheduleBoard({ 
    monitor, 
    appConfig: config, 
    isVisible: true, 
    isLeftSide: isSplitView ? isLeft : undefined 
  });

  const containerClass = isSplitView 
    ? `screen split-screen ${isLeft ? 'left-panel' : 'right-panel'}`
    : 'screen';

  return (
    <Container fluid className={containerClass}>
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
          {!loading && !error && !primaryEntry && (
            <div className="placeholder">
              {formatDisplayMessage(effectiveConfig)}
            </div>
          )}
          {!loading && !error && primaryEntry && (
            <SchedulePane 
              entry={primaryEntry} 
              variant="primary" 
              isSplitView={isSplitView}
            />
          )}
        </Col>
      </Row>
      <Row className="divider" style={{ flexShrink: 0 }} />
      <Row className="footer align-items-center" style={{ minHeight: '30vh' }}>
        <Col>
          <Row className="footer-inner">
            <Col>
              {loading && <div className="placeholder">データを読み込み中...</div>}
              {!loading && error && <div className="placeholder">{error}</div>}
              {!loading && !error && !secondaryEntry && (
                <div className="placeholder">
                  {formatDisplayMessage(effectiveConfig)}
                </div>
              )}
              {!loading && !error && secondaryEntry && (
                <SchedulePane 
                  entry={secondaryEntry} 
                  variant="secondary" 
                  isSplitView={isSplitView}
                />
              )}
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};
