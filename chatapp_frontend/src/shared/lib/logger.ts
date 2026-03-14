export const LogLevel = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

class Logger {
    private level: LogLevel;

    constructor() {
        this.level = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
    }

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
            // eslint-disable-next-line no-console
            console.info(`[INFO] ${message}`, ...args);
        }
    }

    debug(message: string, ...args: unknown[]) {
        if (this.level >= LogLevel.DEBUG) {
            // eslint-disable-next-line no-console
            console.info(`[DEBUG] ${message}`, ...args);
        }
    }
}

export const logger = new Logger();
