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

export interface MonitorConfig {
  id: string;
  title: string;
  dataUrl: string;
  sheetKey?: string;
  hasAudio: boolean;
  refreshIntervalSeconds?: number;
  displayEntryCount?: number;
  headerNote?: string;
  speechFormat?: string;
  speechRate?: number;
  speechPitch?: number;
  speechLang?: string;
}

export interface AppConfig {
  configVersion?: string;
  defaultMonitorId?: string;
  pollingIntervalSeconds?: number;
  speechFormat: string;
  monitors: MonitorConfig[];
}
