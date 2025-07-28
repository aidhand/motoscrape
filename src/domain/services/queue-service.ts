import { EventEmitter } from "events";
import { IQueueService, QueueItem, QueueStatus } from "../interfaces/queue-service.interface.js";

/**
 * Domain service for managing URL processing queue
 */
export class QueueService extends EventEmitter implements IQueueService {
  private queue: QueueItem[] = [];
  private processing: Map<string, QueueItem> = new Map();
  private completed: Map<string, QueueItem> = new Map();
  private failed: Map<string, QueueItem> = new Map();
  
  private options: {
    maxConcurrent: number;
    defaultPriority: number;
    maxRetries: number;
    retryDelay: number;
  };

  constructor(options: Partial<{
    maxConcurrent: number;
    defaultPriority: number;
    maxRetries: number;
    retryDelay: number;
  }> = {}) {
    super();
    
    this.options = {
      maxConcurrent: 3,
      defaultPriority: 5,
      maxRetries: 3,
      retryDelay: 5000,
      ...options,
    };
  }

  /**
   * Add a single URL to the queue
   */
  addUrl(url: string, siteName: string, priority?: number, metadata?: Record<string, any>): string {
    const id = this.generateId();
    const item: QueueItem = {
      id,
      url,
      siteName,
      priority: priority ?? this.options.defaultPriority,
      metadata,
      retryCount: 0,
      createdAt: new Date(),
    };

    // Insert in priority order (higher priority first)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < item.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, item);
    this.emit('item-added', item);
    
    return id;
  }

  /**
   * Add multiple URLs to the queue
   */
  addUrls(items: Array<{url: string; siteName: string; priority?: number; metadata?: Record<string, any>}>): string[] {
    const ids: string[] = [];
    
    for (const item of items) {
      const id = this.addUrl(item.url, item.siteName, item.priority, item.metadata);
      ids.push(id);
    }
    
    this.emit('items-added', items.length);
    return ids;
  }

  /**
   * Get the next item from the queue for processing
   */
  getNext(): QueueItem | null {
    // Check if we're at max concurrent processing
    if (this.processing.size >= this.options.maxConcurrent) {
      return null;
    }

    // Get highest priority item
    const item = this.queue.shift();
    if (!item) {
      return null;
    }

    // Mark as processing
    item.processingStartedAt = new Date();
    this.processing.set(item.id, item);
    this.emit('item-processing', item);
    
    return item;
  }

  /**
   * Mark an item as completed
   */
  markCompleted(id: string, result?: any): void {
    const item = this.processing.get(id);
    if (!item) {
      console.warn(`Attempted to mark non-processing item as completed: ${id}`);
      return;
    }

    this.processing.delete(id);
    this.completed.set(id, { ...item, metadata: { ...item.metadata, result } });
    this.emit('item-completed', item, result);
  }

  /**
   * Mark an item as failed
   */
  markFailed(id: string, error: Error): void {
    const item = this.processing.get(id);
    if (!item) {
      console.warn(`Attempted to mark non-processing item as failed: ${id}`);
      return;
    }

    this.processing.delete(id);
    item.retryCount++;

    // Check if we should retry
    if (item.retryCount < this.options.maxRetries) {
      // Add back to queue with delay
      setTimeout(() => {
        this.queue.unshift(item); // Add to front for retry
        this.emit('item-retry', item, error);
      }, this.options.retryDelay);
    } else {
      // Mark as permanently failed
      this.failed.set(id, { ...item, metadata: { ...item.metadata, error: error.message } });
      this.emit('item-failed', item, error);
    }
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total: this.queue.length + this.processing.size + this.completed.size + this.failed.size,
    };
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.processing.size === 0;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
    this.emit('queue-cleared');
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const status = this.getStatus();
    const totalTime = this.getTotalProcessingTime();
    const avgProcessingTime = this.getAverageProcessingTime();

    return {
      ...status,
      totalProcessingTime: totalTime,
      averageProcessingTime: avgProcessingTime,
      successRate: status.total > 0 ? (status.completed / status.total) * 100 : 0,
    };
  }

  /**
   * Get all items with a specific status
   */
  getItems(status: 'pending' | 'processing' | 'completed' | 'failed'): QueueItem[] {
    switch (status) {
      case 'pending':
        return [...this.queue];
      case 'processing':
        return [...this.processing.values()];
      case 'completed':
        return [...this.completed.values()];
      case 'failed':
        return [...this.failed.values()];
      default:
        return [];
    }
  }

  private generateId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getTotalProcessingTime(): number {
    let total = 0;
    
    for (const item of this.completed.values()) {
      if (item.processingStartedAt) {
        // Use completed time from metadata or estimate current time
        const endTime = item.metadata?.completedAt ? new Date(item.metadata.completedAt) : new Date();
        total += endTime.getTime() - item.processingStartedAt.getTime();
      }
    }
    
    return total;
  }

  private getAverageProcessingTime(): number {
    const completedCount = this.completed.size;
    if (completedCount === 0) return 0;
    
    return this.getTotalProcessingTime() / completedCount;
  }
}