import type { FC } from 'react';
import type { ScheduleEntry } from '../types';
import { Container, Row, Col } from 'react-bootstrap';

interface ScheduleRowProps {
  entry: ScheduleEntry;
  variant: 'primary' | 'secondary';
}

export const ScheduleRow: FC<ScheduleRowProps> = ({ entry, variant }) => {
  // レーン番号を解析して円形アイコンとして表示
  const parseLaneNumbers = (laneStr: string) => {
    if (!laneStr) return [];
    return laneStr.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g) || [];
  };

  const laneNumbers = parseLaneNumbers(entry.lane || '');

  return (
    <Container fluid className={`schedule-row ${variant}`}>
      <Row className="main-line align-items-baseline">
        <Col md={2} className="time">{entry.arrivalTime || '-'}</Col>
        <Col md={7} className="supplier">
          {entry.supplierName ? (
            entry.supplierName.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))
          ) : (
            '未定'
          )}
        </Col>
        {laneNumbers.length > 0 && (
          <Col md={3} className="lane-indicators text-end">
            {laneNumbers.map((num, index) => (
              <span key={index} className="lane-number">{num}</span>
            ))}
          </Col>
        )}
      </Row>
      <Row className="details">
        <Col md={2}></Col>
        <Col md={7}>
          {entry.preparation && <span className="preparation">{entry.preparation}</span>}
          {entry.yard && <span className="yard">　{entry.yard}</span>}
        </Col>
        <Col md={3}>
          {entry.note && <span className="note">　{entry.note}</span>}
          {variant === 'secondary' && entry.restriction && (
            <span className="restriction-note text-end">{entry.restriction}</span>
          )}
        </Col>
      </Row>
    </Container>
  );
};
