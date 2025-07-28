/**
 * Standardized logging system for MotoScrape
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
  component?: string;
}

/**
 * Logger class with contextual logging support
 */
export class Logger {
  private static currentLevel: LogLevel = LogLevel.INFO;
  private static logs: LogEntry[] = [];
  private static maxLogs: number = 1000;

  private component?: string;

  constructor(component?: string) {
    this.component = component;
  }

  /**
   * Set global log level
   */
  static setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        error: LogLevel.ERROR,
      };
      level = levelMap[level.toLowerCase()] ?? LogLevel.INFO;
    }
    Logger.currentLevel = level;
  }

  /**
   * Get all stored logs
   */
  static getLogs(): LogEntry[] {
    return [...Logger.logs];
  }

  /**
   * Clear stored logs
   */
  static clearLogs(): void {
    Logger.logs = [];
  }

  /**
   * Debug logging
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info logging
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning logging
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error logging
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < Logger.currentLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
      component: this.component,
    };

    // Store log entry
    Logger.logs.push(entry);
    
    // Maintain max logs limit
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs = Logger.logs.slice(-Logger.maxLogs);
    }

    // Console output
    this.outputToConsole(entry);
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const component = entry.component ? `[${entry.component}] ` : '';
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    
    const message = `${timestamp} ${component}${entry.message}${context}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 DEBUG: ${message}`);
        break;
      case LogLevel.INFO:
        console.info(`ℹ️  INFO: ${message}`);
        break;
      case LogLevel.WARN:
        console.warn(`⚠️  WARN: ${message}`);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ERROR: ${message}`);
        break;
    }
  }

  /**
   * Log performance timing
   */
  time(label: string): void {
    this.debug(`Timer started: ${label}`, { timer: label, action: 'start' });
  }

  /**
   * End performance timing
   */
  timeEnd(label: string): void {
    this.debug(`Timer ended: ${label}`, { timer: label, action: 'end' });
  }

  /**
   * Log with performance measurement
   */
  async withTiming<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.debug(`Starting: ${label}`);
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.debug(`Completed: ${label}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${label}`, { 
        duration: `${duration}ms`, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.component);
    
    // Override log method to include parent context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, additionalContext?: Record<string, any>) => {
      const mergedContext = { ...context, ...additionalContext };
      originalLog(level, message, mergedContext);
    };
    
    return childLogger;
  }
}

/**
 * Create logger instance for a component
 */
export function createLogger(component: string): Logger {
  return new Logger(component);
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Initialize logging system
 */
export function initializeLogging(config: {
  level?: LogLevel | string;
  maxLogs?: number;
}): void {
  if (config.level !== undefined) {
    Logger.setLevel(config.level);
  }
  
  if (config.maxLogs !== undefined) {
    Logger['maxLogs'] = config.maxLogs;
  }
}

/**
 * Export log statistics
 */
export function getLogStats(): {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByComponent: Record<string, number>;
} {
  const logs = Logger.getLogs();
  
  const logsByLevel = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<LogLevel, number>);
  
  const logsByComponent = logs.reduce((acc, log) => {
    const component = log.component || 'unknown';
    acc[component] = (acc[component] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalLogs: logs.length,
    logsByLevel,
    logsByComponent,
  };
}