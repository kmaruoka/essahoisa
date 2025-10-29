import { Container, Row, Col } from 'react-bootstrap';
import { ScheduleRow } from './ScheduleRow';
import { formatDisplayMessage } from '../utils/formatDisplayMessage';
import { useScheduleScreen } from '../hooks/useScheduleScreen';
import type { AppConfig, MonitorConfig } from '../types';

interface ScheduleScreenProps {
  monitor: MonitorConfig;
  appConfig: AppConfig;
  isSplitView?: boolean;
  isLeft?: boolean;
}

export const ScheduleScreen = ({ 
  monitor, 
  appConfig, 
  isSplitView = false,
  isLeft = true
}: ScheduleScreenProps) => {
  const { 
    loading, 
    error, 
    effectiveConfig, 
    effectiveMonitor, 
    primaryEntry, 
    secondaryEntry, 
    SPEECH_SUPPORTED 
  } = useScheduleScreen({ 
    monitor, 
    appConfig, 
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
            <ScheduleRow 
              entry={primaryEntry} 
              variant="primary" 
              isSplitView={isSplitView}
              showNextIndicator={false}
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
                <ScheduleRow 
                  entry={secondaryEntry} 
                  variant="secondary" 
                  isSplitView={isSplitView}
                  showNextIndicator={true}
                />
              )}
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};
