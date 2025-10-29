import React from 'react';
import type { MonitorConfig } from '../types';
import { ScheduleBoard } from './ScheduleBoard';
import { Container, Row, Col } from 'react-bootstrap';

interface SplitScheduleBoardProps {
  leftMonitor: MonitorConfig;
  rightMonitor: MonitorConfig;
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

export const SplitScheduleBoard = ({ leftMonitor, rightMonitor }: SplitScheduleBoardProps) => {

  return (
    <Container fluid className="split-screen-container">
      
      <Row className="split-screen-row">
        <Col xs={6} className="split-panel">
          {leftMonitor ? (
            <ScheduleBoard 
              monitor={leftMonitor} 
              isLeft={true}
              isSplitView={true}
            />
          ) : (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={true}
            />
          )}
        </Col>
        <Col xs={6} className="split-panel">
          {rightMonitor ? (
            <ScheduleBoard 
              monitor={rightMonitor} 
              isLeft={false}
              isSplitView={true}
            />
          ) : (
            <ErrorMonitorDisplay 
              errorMessage="モニタ設定が見つかりません。"
              isLeft={false}
            />
          )}
        </Col>
      </Row>
    </Container>
  );
};
