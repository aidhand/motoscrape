import { EventEmitter } from "events";

export interface QueueItem {
  id: string;
  url: string;
  siteName: string;
  priority: number;
  retryCount: number;
  createdAt: Date;
  scheduledAt: Date;
  metadata?: Record<string, any>;
}

export interface QueueOptions {
  maxConcurrent: number;
  defaultPriority: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitDelay: number;
}

export type QueueStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retry";

/**
 * URL queue management with rate limiting and retry logic
 */
export class QueueManager extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing: Map<string, QueueItem> = new Map();
  private completed: Map<string, QueueItem> = new Map();
  private failed: Map<string, QueueItem> = new Map();
  private lastProcessedTime = 0;
  private options: QueueOptions;

  constructor(options: Partial<QueueOptions> = {}) {
    super();

    this.options = {
      maxConcurrent: 3,
      defaultPriority: 5,
      maxRetries: 3,
      retryDelay: 5000,
      rateLimitDelay: 1000,
      ...options,
    };
  }

  /**
   * Add a URL to the queue
   */
  add(
    url: string,
    siteName: string,
    options: Partial<Pick<QueueItem, "priority" | "metadata">> = {}
  ): string {
    const id = this.generateId();
    const now = new Date();

    const item: QueueItem = {
      id,
      url,
      siteName,
      priority: options.priority || this.options.defaultPriority,
      retryCount: 0,
      createdAt: now,
      scheduledAt: now,
      metadata: options.metadata,
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(
      (existing) => existing.priority < item.priority
    );
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.emit("item-added", item);
    // Add debug logging if needed, e.g.:
    // if (this.options.debug) console.debug(`Queue item added: ${item.url}`);
    return id;
  }

  /**
   * Add multiple URLs to the queue
   */
  addBatch(
    urls: Array<{
      url: string;
      siteName: string;
      priority?: number;
      metadata?: Record<string, any>;
    }>
  ): string[] {
    return urls.map((item) =>
      this.add(item.url, item.siteName, {
        priority: item.priority,
        metadata: item.metadata,
      })
    );
  }

  /**
   * Get the next item to process
   */
  getNext(): QueueItem | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Check if we need to wait for rate limiting
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessedTime;

    if (timeSinceLastProcess < this.options.rateLimitDelay) {
      return null;
    }

    // Check if we've reached max concurrent limit
    if (this.processing.size >= this.options.maxConcurrent) {
      return null;
    }

    // Find the next item that's ready to be processed
    const readyIndex = this.queue.findIndex(
      (item) => item.scheduledAt.getTime() <= now
    );

    if (readyIndex === -1) {
      return null;
    }

    const item = this.queue.splice(readyIndex, 1)[0];
    this.processing.set(item.id, item);
    this.lastProcessedTime = now;

    this.emit("item-processing", item);
    // Removed verbose processing logging - only essential messages remain
    return item;
  }

  /**
   * Mark an item as completed
   */
  markCompleted(id: string, result?: any): void {
    const item = this.processing.get(id);
    if (!item) {
      console.warn(`Attempted to mark unknown item as completed: ${id}`);
      return;
    }

    this.processing.delete(id);
    this.completed.set(id, { ...item, metadata: { ...item.metadata, result } });

    this.emit("item-completed", item, result);
    console.log(`Completed: ${item.url}`);
  }

  /**
   * Mark an item as failed and potentially retry
   */
  markFailed(id: string, error: Error): void {
    const item = this.processing.get(id);
    if (!item) {
      console.warn(`Attempted to mark unknown item as failed: ${id}`);
      return;
    }

    this.processing.delete(id);

    // Check if we should retry
    if (item.retryCount < this.options.maxRetries) {
      const retryItem: QueueItem = {
        ...item,
        retryCount: item.retryCount + 1,
        scheduledAt: new Date(
          Date.now() + this.options.retryDelay * Math.pow(2, item.retryCount)
        ),
      };

      // Add back to queue with exponential backoff
      this.queue.unshift(retryItem);
      this.emit("item-retry", retryItem, error);
      console.log(
        `Retrying: ${item.url} (attempt ${retryItem.retryCount + 1}/${this.options.maxRetries + 1})`
      );
    } else {
      // Max retries reached, mark as permanently failed
      this.failed.set(id, {
        ...item,
        metadata: { ...item.metadata, error: error.message },
      });
      this.emit("item-failed", item, error);
      console.error(`Failed permanently: ${item.url} - ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total:
        this.queue.length +
        this.processing.size +
        this.completed.size +
        this.failed.size,
    };
  }

  /**
   * Get items by status
   */
  getItems(status: QueueStatus): QueueItem[] {
    switch (status) {
      case "pending":
        return [...this.queue];
      case "processing":
        return Array.from(this.processing.values());
      case "completed":
        return Array.from(this.completed.values());
      case "failed":
        return Array.from(this.failed.values());
      case "retry":
        return this.queue.filter((item) => item.retryCount > 0);
      default:
        return [];
    }
  }

  /**
   * Remove an item from the queue
   */
  remove(id: string): boolean {
    // Check pending queue
    const queueIndex = this.queue.findIndex((item) => item.id === id);
    if (queueIndex !== -1) {
      const item = this.queue.splice(queueIndex, 1)[0];
      this.emit("item-removed", item);
      return true;
    }

    // Cannot remove items that are processing
    if (this.processing.has(id)) {
      console.warn(`Cannot remove item that is currently processing: ${id}`);
      return false;
    }

    return false;
  }

  /**
   * Clear all queues
   */
  clear(): void {
    const stats = this.getStats();

    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();

    this.emit("queue-cleared", stats);
    console.log(`Queue cleared: ${stats.total} items removed`);
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.emit("queue-paused");
    console.log("Queue processing paused");
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.emit("queue-resumed");
    console.log("Queue processing resumed");
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.processing.size === 0;
  }

  /**
   * Get estimated time until queue is empty
   */
  getEstimatedCompletion(): number {
    if (this.isEmpty()) {
      return 0;
    }

    const avgProcessingTime = this.options.rateLimitDelay + 5000; // Estimate 5s per item
    const remainingItems = this.queue.length + this.processing.size;

    return Math.ceil(
      (remainingItems * avgProcessingTime) / this.options.maxConcurrent
    );
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
