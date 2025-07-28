/**
 * Standardized error handling utilities for MotoScrape
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  CONFIGURATION = 'CONFIGURATION',
  BROWSER = 'BROWSER',
  UNKNOWN = 'UNKNOWN'
}

export interface ScrapingError {
  type: ErrorType;
  message: string;
  context?: {
    url?: string;
    site?: string;
    adapter?: string;
    selector?: string;
    retryAttempt?: number;
  };
  originalError?: Error;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * Create a standardized scraping error
 */
export function createScrapingError(
  type: ErrorType,
  message: string,
  context?: ScrapingError['context'],
  originalError?: Error
): ScrapingError {
  return {
    type,
    message,
    context,
    originalError,
    timestamp: new Date(),
    recoverable: isRecoverableError(type, originalError)
  };
}

/**
 * Determine if an error is recoverable
 */
export function isRecoverableError(type: ErrorType, originalError?: Error): boolean {
  switch (type) {
    case ErrorType.NETWORK:
    case ErrorType.TIMEOUT:
    case ErrorType.RATE_LIMIT:
      return true;
    case ErrorType.BROWSER:
      // Some browser errors are recoverable
      return originalError?.message.includes('Target closed') === false;
    case ErrorType.CONFIGURATION:
    case ErrorType.VALIDATION:
      return false;
    case ErrorType.PARSING:
      // Parsing errors might be recoverable if it's due to temporary page changes
      return true;
    default:
      return false;
  }
}

/**
 * Format error for logging
 */
export function formatError(error: ScrapingError): string {
  const contextStr = error.context ? 
    ` [${Object.entries(error.context).map(([k, v]) => `${k}=${v}`).join(', ')}]` : 
    '';
  
  return `${error.type}: ${error.message}${contextStr}`;
}

/**
 * Async error wrapper with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000,
  context?: ScrapingError['context']
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Determine error type
      const errorType = classifyError(error as Error);
      const scrapingError = createScrapingError(
        errorType,
        (error as Error).message,
        { ...context, retryAttempt: attempt },
        error as Error
      );
      
      // Don't retry if error is not recoverable
      if (!scrapingError.recoverable) {
        throw scrapingError;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw scrapingError;
      }
      
      // Wait before retry with exponential backoff
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This shouldn't be reached, but TypeScript requires it
  throw createScrapingError(
    ErrorType.UNKNOWN,
    lastError?.message || 'Unknown error',
    context,
    lastError
  );
}

/**
 * Classify error by type
 */
function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorType.TIMEOUT;
  }
  
  if (message.includes('network') || message.includes('connection') || 
      message.includes('enotfound') || message.includes('econnrefused')) {
    return ErrorType.NETWORK;
  }
  
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return ErrorType.RATE_LIMIT;
  }
  
  if (message.includes('browser') || message.includes('target closed') || 
      message.includes('navigation')) {
    return ErrorType.BROWSER;
  }
  
  if (message.includes('parse') || message.includes('json') || 
      message.includes('selector')) {
    return ErrorType.PARSING;
  }
  
  if (message.includes('validation') || message.includes('schema')) {
    return ErrorType.VALIDATION;
  }
  
  if (message.includes('config')) {
    return ErrorType.CONFIGURATION;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Safe execution wrapper that converts errors to ScrapingError
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  context?: ScrapingError['context']
): Promise<{ success: true; data: T } | { success: false; error: ScrapingError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorType = classifyError(error as Error);
    const scrapingError = createScrapingError(
      errorType,
      (error as Error).message,
      context,
      error as Error
    );
    return { success: false, error: scrapingError };
  }
}

/**
 * Aggregate multiple errors into a single error report
 */
export function aggregateErrors(errors: ScrapingError[]): {
  totalErrors: number;
  recoverableErrors: number;
  errorsByType: Record<ErrorType, number>;
  mostCommonError: ErrorType;
} {
  const errorsByType = errors.reduce((acc, error) => {
    acc[error.type] = (acc[error.type] || 0) + 1;
    return acc;
  }, {} as Record<ErrorType, number>);
  
  const mostCommonError = Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as ErrorType || ErrorType.UNKNOWN;
  
  return {
    totalErrors: errors.length,
    recoverableErrors: errors.filter(e => e.recoverable).length,
    errorsByType,
    mostCommonError
  };
}