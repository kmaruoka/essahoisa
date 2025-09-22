import type { FC } from 'react';
import type { ScheduleEntry } from '../types';

interface ScheduleRowProps {
  entry: ScheduleEntry;
  variant: 'primary' | 'secondary';
}

export const ScheduleRow: FC<ScheduleRowProps> = ({ entry, variant }) => {
  return (
    <div className={`schedule-row ${variant}`}>
      <div className="time">{entry.arrivalTime || '-'}</div>
      <div className="content">
        <div className="supplier">{entry.supplierName || '未定'}</div>
        <div className="secondary">
          {entry.lane && <span className="lane">{entry.lane}</span>}
          {entry.preparation && <span className="preparation">{entry.preparation}</span>}
          {entry.yard && <span className="yard">{entry.yard}</span>}
        </div>
        {entry.note && <div className="note">{entry.note}</div>}
      </div>
    </div>
  );
};
