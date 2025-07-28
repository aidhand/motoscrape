import { EventEmitter } from "events";

/**
 * Queue item for processing
 */
export interface QueueItem {
  id: string;
  url: string;
  siteName: string;
  priority: number;
  metadata?: Record<string, any>;
  retryCount: number;
  createdAt: Date;
  processingStartedAt?: Date;
}

/**
 * Queue status information
 */
export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Interface for queue management service
 */
export interface IQueueService extends EventEmitter {
  /**
   * Add a single URL to the queue
   */
  addUrl(url: string, siteName: string, priority?: number, metadata?: Record<string, any>): string;

  /**
   * Add multiple URLs to the queue
   */
  addUrls(items: Array<{url: string; siteName: string; priority?: number; metadata?: Record<string, any>}>): string[];

  /**
   * Get the next item from the queue for processing
   */
  getNext(): QueueItem | null;

  /**
   * Mark an item as completed
   */
  markCompleted(id: string, result?: any): void;

  /**
   * Mark an item as failed
   */
  markFailed(id: string, error: Error): void;

  /**
   * Get queue status
   */
  getStatus(): QueueStatus;

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean;

  /**
   * Clear all items from the queue
   */
  clear(): void;
}