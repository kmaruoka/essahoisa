import type { FC } from 'react';
import { useEffect, useState } from 'react';
import type { ScheduleEntry } from '../types';
import { Container, Row, Col } from 'react-bootstrap';
import { addPlaybackStateListener, isEntryPlaying } from '../utils/audioPlaybackState';

interface SchedulePaneProps {
  entry: ScheduleEntry;
  variant: 'primary' | 'secondary';
  isSplitView?: boolean;
  showNextIndicator?: boolean;
}

export const SchedulePane: FC<SchedulePaneProps> = ({ entry, variant, isSplitView = false, showNextIndicator = false }) => {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // 音声再生状態を監視
  useEffect(() => {
    const cleanup = addPlaybackStateListener((_state) => {
      const entryPlaying = isEntryPlaying(entry.id);
      setIsAudioPlaying(entryPlaying);
    });

    // 初回状態をチェック
    const initialEntryPlaying = isEntryPlaying(entry.id);
    setIsAudioPlaying(initialEntryPlaying);

    return cleanup;
  }, [entry.id]);

  return (
    <Container fluid className={`schedule-row ${variant} ${isAudioPlaying ? 'audio-playing' : ''}`}>
      {/* 1行目：時刻（オレンジ色）、仕入れ先名（オレンジ色） */}
      {isSplitView ? (
        <>
          <Row className="mt-1 align-items-baseline">
            {showNextIndicator && (
              <Col md="auto" lg="auto" className="next-indicator">次</Col>
            )}
            <Col md={showNextIndicator ? 10 : 12} lg={showNextIndicator ? 10 : 12} className="time">
              {entry.arrivalTime || '-'}
            </Col>
          </Row>
          <Row className="mt-2">
            <Col md={12} lg={12} className="supplier">
              {entry.supplierName.split('\n').map((line, index) => (
                <div key={index} className="supplier-text">{line}</div>
              ))}
            </Col>
          </Row>
        </>
      ) : (
        <Row className="mt-1 align-items-baseline">
          {showNextIndicator && (
            <Col md="auto" lg="auto" className="next-indicator">次</Col>
          )}
          <Col md={2} lg={2} className="time">
            {entry.arrivalTime || '-'}
          </Col>
          <Col md={showNextIndicator ? 9 : 10} lg={showNextIndicator ? 9 : 10} className="supplier">
            {entry.supplierName.split('\n').map((line, index) => (
              <div key={index} className="supplier-text">{line}</div>
            ))}
          </Col>
        </Row>
      )}
      
      {/* 2行目：詳細を横並びで可変ラップ表示（元レイアウト） */}
      <Row className="mt-1">
        {entry.preparation && (
          <Col md="auto" lg="auto"><span className="preparation">{entry.preparation}</span></Col>
        )}
        {entry.yard && (
          <Col md="auto" lg="auto"><span className="yard">{entry.yard}</span></Col>
        )}
        {entry.lane && (
          <Col md="auto" lg="auto"><span className="lane">{entry.lane}</span></Col>
        )}
        {entry.note && (
          <Col md="auto" lg="auto"><span className="note-text">{entry.note}</span></Col>
        )}
      </Row>
    </Container>
  );
};
