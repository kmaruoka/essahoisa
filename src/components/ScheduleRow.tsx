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
      {/* 時刻と仕入先の行（レスポンシブ対応） */}
      <Row className="main-line align-items-baseline">
        <Col md={2} lg={2} className="time">{entry.arrivalTime || '-'}</Col>
        <Col md={10} lg={10} className="supplier">
          {entry.supplierName ? (
            entry.supplierName.split('\n').map((line, index) => (
              <div key={index} className="supplier-text">{line}</div>
            ))
          ) : (
            <div className="supplier-text">未定</div>
          )}
        </Col>
      </Row>
      
      {/* 緑文字項目の行（横幅いっぱいに表示） */}
      <Row className="details">
        <Col md={2} lg={2}></Col>
        <Col md={10} lg={10} className="details-content">
          <div className="details-line">
            {entry.preparation && <span className="preparation">{entry.preparation}</span>}
            {entry.yard && <span className="yard">　{entry.yard}</span>}
          </div>
        </Col>
      </Row>
      
      {/* 最下行：レーン番号と白文字 */}
      <Row className="bottom-line">
        <Col md={2} lg={2}></Col>
        <Col md={10} lg={10} className="bottom-content">
          <div className="bottom-line">
            {entry.lane && <span className="lane">　{entry.lane}</span>}
            {entry.note && <span className="note">　{entry.note}</span>}
          </div>
        </Col>
      </Row>
    </Container>
  );
};
