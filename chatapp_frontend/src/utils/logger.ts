// src/utils/logger.ts

const LogLevel = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
} as const;

type LogLevelValue = typeof LogLevel[keyof typeof LogLevel];

class Logger {
  private currentLevel: LogLevelValue;

  constructor(level: LogLevelValue = LogLevel.DEBUG) {
    this.currentLevel = level;
  }

  error(...args: Parameters<typeof console.error>): void {
    if (this.currentLevel >= LogLevel.ERROR) {
      console.error(...args);
    }
  }

  warn(...args: Parameters<typeof console.warn>): void {
    if (this.currentLevel >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  info(...args: Parameters<typeof console.log>): void {
    if (this.currentLevel >= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }

  debug(...args: Parameters<typeof console.log>): void {
    if (this.currentLevel >= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }
}

export const logger = new Logger(
  import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN
);

export { LogLevel };
