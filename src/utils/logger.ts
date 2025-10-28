// ログレベル制御システム

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel = LogLevel.INFO; // デフォルトはINFOレベル

  setLevel(level: LogLevel) {
    this.level = level;
  }

  error(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

// 本番環境ではINFOレベル、開発環境ではDEBUGレベル
if (import.meta.env.PROD) {
  logger.setLevel(LogLevel.INFO);
} else {
  logger.setLevel(LogLevel.INFO);
}
