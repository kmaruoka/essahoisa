import { useEffect, useState } from 'react';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleScreen } from './ScheduleScreen';
import { Container, Row, Col } from 'react-bootstrap';

interface SplitScheduleScreenProps {
  leftMonitor: MonitorConfig;
  rightMonitor: MonitorConfig;
  appConfig: AppConfig;
}

// エラーモニタ用のコンポーネント
const ErrorMonitorDisplay = ({ 
  errorMessage, 
  isLeft = true
}: { 
  errorMessage: string; 
  isLeft?: boolean;
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

export const SplitScheduleScreen = ({ leftMonitor, rightMonitor, appConfig }: SplitScheduleScreenProps) => {
  // URLパラメータから表示するモニターを決定
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showLeft = params.get('showLeft') !== 'false';
    const showRight = params.get('showRight') !== 'false';
    setLeftVisible(showLeft);
    setRightVisible(showRight);
  }, []);

  return (
    <Container fluid className="split-screen-container">
      
      <Row className="split-screen-row">
        <Col lg={6} md={12} className="split-panel">
          {leftMonitor && leftVisible ? (
            <ScheduleScreen 
              monitor={leftMonitor} 
              appConfig={appConfig} 
              isLeft={true}
              isSplitView={true}
              showNextIndicator={false}
            />
          ) : leftVisible ? (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={true}
            />
          ) : (
            <div className="screen split-screen left-panel">
              <div className="placeholder">左側のモニターは非表示です</div>
            </div>
          )}
        </Col>
        <Col lg={6} md={12} className="split-panel">
          {rightMonitor && rightVisible ? (
            <ScheduleScreen 
              monitor={rightMonitor} 
              appConfig={appConfig} 
              isLeft={false}
              isSplitView={true}
              showNextIndicator={false}
            />
          ) : rightVisible ? (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={false}
            />
          ) : (
            <div className="screen split-screen right-panel">
              <div className="placeholder">右側のモニターは非表示です</div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};
