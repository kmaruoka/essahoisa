export interface ScheduleEntry {
  id: string;
  order?: string;
  arrivalTime: string;
  finishTime?: string;
  supplierName: string;
  preparation?: string;
  note?: string;
  yard?: string;
  lane?: string;
  supplierReading?: string;
  materialReading?: string;
}

export interface ScheduleFile {
  meta?: {
    sheetName?: string;
    sourceFile?: string;
    generatedAt?: string;
    configKey?: string;
  };
  entries: ScheduleEntry[];
}

export interface AudioSettings {
  timings: number[]; // 入線時間の何分前に音声案内するか（分単位）
}

export interface MonitorConfig {
  id: string;
  title: string;
  dataUrl: string;
  hasAudio: boolean;
  speechFormat?: string;
  speechRate?: number;
  speechPitch?: number;
  speechLang?: string;
  audioSettings?: AudioSettings;
}

export interface DisplaySettings {
  beforeMinutes: number; // arrivalTimeの何分前から表示するか
  emptyTimeMessage: string; // 何も表示されない時間帯の文言
}

export interface AppConfig {
  configVersion?: string;
  defaultMonitorId?: string;
  pollingIntervalSeconds?: number;
  speechFormat: string;
  displaySettings?: DisplaySettings;
  monitors: MonitorConfig[];
}
