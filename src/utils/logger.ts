// ログレベル制御システム

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel = LogLevel.INFO; // デフォルトはINFOレベル
  private logHistory = new Map<string, number>();
  private readonly LOG_DEDUP_INTERVAL = 10000; // 10秒以内の同じメッセージは重複とみなす

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(message: string): boolean {
    const now = Date.now();
    const lastTime = this.logHistory.get(message);
    
    if (lastTime && now - lastTime < this.LOG_DEDUP_INTERVAL) {
      return false;
    }
    
    this.logHistory.set(message, now);
    return true;
  }

  private formatTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  error(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[${this.formatTimestamp()}] [ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[${this.formatTimestamp()}] [WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.INFO && this.shouldLog(message)) {
      console.log(`[${this.formatTimestamp()}] [INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[${this.formatTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

// 本番環境ではINFOレベル、開発環境ではDEBUGレベル
if (process.env.NODE_ENV === 'production') {
  logger.setLevel(LogLevel.INFO);
} else {
  logger.setLevel(LogLevel.DEBUG);
}
