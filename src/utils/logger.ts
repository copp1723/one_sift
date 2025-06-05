/**
 * Logger Utility
 * Provides structured logging with different levels and context
 */

import { FastifyRequest } from 'fastify';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  customerId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private level: LogLevel;
  private serviceName: string;
  private isDevelopment: boolean;

  constructor(serviceName: string = 'one-sift') {
    this.serviceName = serviceName;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatLogEntry(
    level: string,
    message: string,
    context?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message
    };

    if (context) {
      const { error, ...restContext } = context;
      
      if (Object.keys(restContext).length > 0) {
        entry.context = restContext;
      }
      
      if (error) {
        entry.error = {
          message: error.message,
          code: (error as any).code,
          ...(this.isDevelopment && { stack: error.stack })
        };
      }
    }

    return entry;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: LogContext): void {
    if (level > this.level) return;

    const entry = this.formatLogEntry(levelName, message, context);
    const output = this.isDevelopment ? 
      this.formatDevelopmentOutput(entry) : 
      JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private formatDevelopmentOutput(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;
    let output = `[${timestamp}] ${level}: ${message}`;
    
    if (context) {
      output += '\n  Context: ' + JSON.stringify(context, null, 2);
    }
    
    if (error) {
      output += '\n  Error: ' + error.message;
      if (error.stack) {
        output += '\n  Stack: ' + error.stack;
      }
    }
    
    return output;
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, 'error', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'warn', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'info', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'debug', message, context);
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }

  /**
   * Log HTTP request
   */
  logRequest(request: FastifyRequest, reply: any, duration: number): void {
    const context: LogContext = {
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      duration,
      requestId: request.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip
    };

    const level = reply.statusCode >= 500 ? 'error' : 
                  reply.statusCode >= 400 ? 'warn' : 'info';
    
    const message = `${request.method} ${request.url} ${reply.statusCode} ${duration}ms`;
    
    switch (level) {
      case 'error': this.error(message, context); break;
      case 'warn': this.warn(message, context); break;
      default: this.info(message, context);
    }
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the logger instance and the Logger class
export { logger, Logger };

// Helper function to create logger for specific module
export function createLogger(moduleName: string): ChildLogger {
  return logger.child({ module: moduleName });
}