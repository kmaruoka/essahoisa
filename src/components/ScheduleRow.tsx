import type { FC } from 'react';
import type { ScheduleEntry } from '../types';
import { Container, Row, Col } from 'react-bootstrap';

interface ScheduleRowProps {
  entry: ScheduleEntry;
  variant: 'primary' | 'secondary';
}

export const ScheduleRow: FC<ScheduleRowProps> = ({ entry, variant }) => {
  return (
    <Container fluid className={`schedule-row ${variant}`}>
      <Row className="main-line align-items-baseline">
        <Col md={2} className="time">{entry.arrivalTime || '-'}</Col>
        <Col md={10} className="supplier">
          {entry.supplierName ? (
            entry.supplierName.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))
          ) : (
            '未定'
          )}
        </Col>
      </Row>
      <Row className="details">
        <Col md={2}></Col>
        <Col md={7}>
          {entry.preparation && <span className="preparation">{entry.preparation}</span>}
          {entry.yard && <span className="yard">　{entry.yard}</span>}
          {entry.lane && <span className="lane">　{entry.lane}</span>}
        </Col>
        <Col md={3}>
          {entry.note && <span className="note">　{entry.note}</span>}
        </Col>
      </Row>
    </Container>
  );
};
