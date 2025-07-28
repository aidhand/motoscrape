import { Page } from "playwright";

/**
 * Browser management interface
 */
export interface IBrowserService {
  /**
   * Initialize browser
   */
  initialize(): Promise<void>;

  /**
   * Create a new page for a specific site
   */
  createPage(siteName: string): Promise<Page>;

  /**
   * Navigate to URL with retry logic
   */
  navigateWithRetry(page: Page, url: string, maxRetries?: number): Promise<void>;

  /**
   * Simulate human-like behavior
   */
  simulateHumanBehavior(page: Page): Promise<void>;

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean;

  /**
   * Close browser
   */
  close(): Promise<void>;
}