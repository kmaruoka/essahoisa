export interface ScheduleEntry {
  id: string;
  number?: string;
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
  refreshIntervalSeconds?: number;
  speechFormat?: string;
  speechRate?: number;
  speechPitch?: number;
  speechLang?: string;
  audioSettings?: AudioSettings;
}

export interface AppConfig {
  configVersion?: string;
  defaultMonitorId?: string;
  pollingIntervalSeconds?: number;
  speechFormat: string;
  monitors: MonitorConfig[];
}
