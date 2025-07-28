/**
 * Application configuration types
 */

export interface ServiceConfiguration {
  enabled: boolean;
  options?: Record<string, any>;
}

export interface ServicesConfig {
  scraping: ServiceConfiguration;
  queue: ServiceConfiguration;
  validation: ServiceConfiguration;
  browser: ServiceConfiguration;
  storage: ServiceConfiguration;
  rateLimiting: ServiceConfiguration;
  monitoring: ServiceConfiguration;
}

/**
 * Dependency injection token types
 */
export const SERVICE_TOKENS = {
  // Domain services
  SCRAPING_SERVICE: Symbol('ScrapingService'),
  QUEUE_SERVICE: Symbol('QueueService'),
  VALIDATION_SERVICE: Symbol('ValidationService'),
  
  // Infrastructure services
  BROWSER_SERVICE: Symbol('BrowserService'),
  STORAGE_SERVICE: Symbol('StorageService'),
  RATE_LIMITING_SERVICE: Symbol('RateLimitingService'),
  MONITORING_SERVICE: Symbol('MonitoringService'),
  
  // Configuration
  APP_SETTINGS: Symbol('AppSettings'),
  SITE_CONFIGS: Symbol('SiteConfigs'),
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];