# MotoScrape Improvement Plan

This document outlines planned enhancements to the MotoScrape web scraper, focusing on comprehensive collection scraping, data output automation, configuration management, logging consolidation, and real-time monitoring capabilities.

## 🎯 Overview

The following improvements will enhance MotoScrape's efficiency, usability, and maintainability while preserving the existing event-driven architecture and modular design principles.

---

## 1. Collection Page Queueing System

### **Current State**
- Manual URL addition for collection pages
- No automatic discovery of pagination or subcategories
- Limited coverage of site inventory

### **Planned Improvements**

#### 1.1 Automatic Collection Discovery
```typescript
// New CollectionDiscoveryManager class
export class CollectionDiscoveryManager {
  async discoverCollections(siteConfig: SiteConfig): Promise<CollectionInfo[]>
  async extractPaginationUrls(collectionUrl: string): Promise<string[]>
  async findSubcategories(categoryUrl: string): Promise<CategoryInfo[]>
}
```

**Implementation Plan:**
- **Phase 1**: Extend `QueueManager` with collection-specific queuing logic
- **Phase 2**: Add pagination detection using site-specific selectors
- **Phase 3**: Implement sitemap parsing for comprehensive URL discovery
- **Phase 4**: Add breadth-first traversal for category hierarchies

#### 1.2 Smart Collection Processing
```typescript
// Enhanced QueueItem with collection metadata
interface CollectionQueueItem extends QueueItem {
  pageType: 'collection' | 'product' | 'category';
  collectionInfo: {
    totalProducts?: number;
    currentPage: number;
    hasNextPage: boolean;
    subcategories: string[];
  };
}
```

**Features:**
- Automatic pagination detection and queueing
- Subcategory discovery and traversal  
- Product count estimation for progress tracking
- Duplicate URL prevention with normalized URLs

#### 1.3 Collection-Aware Adapters
**Extend existing adapters:**
- **ShopifyAdapter**: Leverage Shopify's collection API patterns
- **MCASAdapter**: Custom collection traversal logic
- **GenericAdapter**: Heuristic-based collection discovery

**Site Config Extensions:**
```json
{
  "collection_discovery": {
    "pagination_selector": ".pagination__next",
    "product_count_selector": ".collection-count",
    "subcategory_selector": ".collection-nav a",
    "max_pages_per_collection": 50,
    "collection_patterns": ["/collections/*", "/category/*"]
  }
}
```

---

## 2. Automatic Dual-Format Data Output

### **Current State**
- Single format output (JSON, SQLite, or CSV)
- Manual format selection in configuration
- No simultaneous multi-format export

### **Planned Improvements**

#### 2.1 Enhanced Storage Manager
```typescript
// Updated StorageManager with automatic dual output
export class StorageManager {
  private primaryFormats: StorageFormat[] = ['json', 'sqlite'];
  
  async storeProductsAuto(products: Product[]): Promise<StorageResult[]> {
    // Automatically output to both JSON and SQL formats
    return Promise.all([
      this.storeAsJSON(products),
      this.storeAsSQLite(products)
    ]);
  }
}
```

#### 2.2 Real-time Data Streaming
```typescript
// New DataStreamManager for real-time output
export class DataStreamManager extends EventEmitter {
  async streamProduct(product: Product): Promise<void> {
    // Immediately write to both formats
    await Promise.all([
      this.appendToJSON(product),
      this.insertToSQLite(product)
    ]);
    
    this.emit('product-saved', { product, formats: ['json', 'sqlite'] });
  }
}
```

**Implementation Plan:**
- **Phase 1**: Modify StorageManager to support multiple simultaneous formats
- **Phase 2**: Implement streaming writes for real-time data availability
- **Phase 3**: Add data validation and deduplication logic
- **Phase 4**: Create unified query interface for cross-format data access

#### 2.3 Output Configuration
```json
{
  "output_settings": {
    "auto_formats": ["json", "sqlite"],
    "stream_mode": true,
    "deduplication": true,
    "backup_frequency": "hourly",
    "compression": {
      "json": "gzip",
      "csv": "none"
    }
  }
}
```

---

## 3. JSON-Based Configuration Management

### **Current State**
- Hardcoded configuration in `src/index.ts`
- Mixed configuration and application logic
- Difficult to modify settings without code changes

### **Planned Improvements**

#### 3.1 Configuration File Structure
```
config/
├── app-settings.json          # Global application settings
├── sites/
│   ├── motoheaven.json       # Site-specific configurations
│   ├── mcas.json
│   └── template.json         # Template for new sites
├── logging.json              # Logging configuration
└── monitoring.json           # Real-time monitoring settings
```

#### 3.2 Configuration Loader
```typescript
export class ConfigurationLoader {
  static async loadAppSettings(): Promise<AppSettings>
  static async loadSiteConfigs(): Promise<SiteConfig[]>
  static async loadSiteConfig(siteName: string): Promise<SiteConfig>
  static async validateConfiguration(): Promise<ValidationResult>
}
```

#### 3.3 Example Configuration Files

**config/app-settings.json:**
```json
{
  "global_settings": {
    "headless": true,
    "timeout": 30000,
    "max_retries": 3,
    "max_concurrent_requests": 3,
    "delay_between_requests": 1000,
    "max_requests_per_minute": 60,
    "output_directory": "./data",
    "image_download": false,
    "log_level": "info"
  },
  "browser_settings": {
    "viewport": { "width": 1920, "height": 1080 },
    "locale": "en-AU",
    "timezone": "Australia/Sydney"
  },
  "output_settings": {
    "auto_formats": ["json", "sqlite"],
    "stream_mode": true
  }
}
```

**config/sites/motoheaven.json:**
```json
{
  "name": "motoheaven",
  "base_url": "https://www.motoheaven.com.au",
  "adapter_type": "shopify",
  "rate_limit": {
    "requests_per_minute": 30,
    "delay_between_requests": 5000,
    "concurrent_requests": 6
  },
  "categories": ["helmets", "jackets", "gloves", "boots", "pants", "accessories"],
  "selectors": {
    "product_container": ".product-item",
    "product_name": ".product-item__product-title",
    "price": ".product-item__price-main"
  },
  "collection_discovery": {
    "pagination_selector": ".pagination__next",
    "max_pages_per_collection": 50
  }
}
```

**Implementation Plan:**
- **Phase 1**: Create configuration file structure and loader
- **Phase 2**: Migrate existing hardcoded configurations
- **Phase 3**: Add configuration validation and error handling
- **Phase 4**: Implement hot-reload for configuration changes

---

## 4. Consolidated Logging System

### **Current State**
- Scattered console.log statements throughout codebase
- No structured logging format
- Limited log persistence and filtering

### **Planned Improvements**

#### 4.1 Unified Logger Architecture
```typescript
export class LoggerManager {
  private consoleLogger: ConsoleLogger;
  private fileLogger: FileLogger;
  private structuredLogger: StructuredLogger;
  
  constructor(config: LoggingConfig) {
    // Initialize all logging backends transparently
  }
  
  info(message: string, metadata?: object): void {
    // Write to both console and file simultaneously
  }
  
  error(message: string, error?: Error, metadata?: object): void {
    // Enhanced error logging with stack traces
  }
}
```

#### 4.2 Logging Configuration
**config/logging.json:**
```json
{
  "level": "info",
  "console": {
    "enabled": true,
    "format": "pretty",
    "colors": true
  },
  "file": {
    "enabled": true,
    "path": "./logs",
    "rotation": "daily",
    "max_files": 30,
    "format": "json"
  },
  "categories": {
    "scraper": "info",
    "queue": "debug",
    "storage": "info",
    "rate-limiter": "warn"
  }
}
```

#### 4.3 Structured Logging Features
- **Contextual Logging**: Include site name, URL, timestamp in all logs
- **Performance Metrics**: Automatic timing and performance logging
- **Error Aggregation**: Collect and categorize errors for analysis
- **Log Correlation**: Track requests across components with correlation IDs

**Implementation Plan:**
- **Phase 1**: Create unified logger interface and implementations
- **Phase 2**: Replace existing console.log statements throughout codebase
- **Phase 3**: Add structured metadata and contextual information
- **Phase 4**: Implement log rotation, filtering, and search capabilities

---

## 5. Real-time Queue Monitoring & Debugging

### **Current State**
- Limited queue visibility
- Static queue status reporting
- No interactive debugging capabilities

### **Planned Improvements**

#### 5.1 Queue Monitoring Dashboard
```typescript
export class QueueMonitor extends EventEmitter {
  private server: WebSocketServer;
  
  startMonitoring(port: number = 3001): void {
    // Start WebSocket server for real-time updates
  }
  
  getQueueSnapshot(): QueueSnapshot {
    return {
      pending: this.queue.getPendingItems(),
      processing: this.queue.getProcessingItems(),
      completed: this.queue.getCompletedCount(),
      failed: this.queue.getFailedItems(),
      statistics: this.getPerformanceStats()
    };
  }
}
```

#### 5.2 Interactive Queue Control
```typescript
export class QueueController {
  async pauseQueue(): Promise<void>
  async resumeQueue(): Promise<void>
  async retryFailedItems(): Promise<void>
  async clearQueue(): Promise<void>
  async adjustPriority(itemId: string, newPriority: number): Promise<void>
  async removeItem(itemId: string): Promise<void>
}
```

#### 5.3 Real-time Monitoring Features
- **Live Queue Status**: Real-time updates of queue state via WebSocket
- **Processing Timeline**: Visual timeline of item processing
- **Error Analysis**: Categorized error reporting with retry suggestions
- **Performance Graphs**: Throughput, success rate, and latency charts
- **Rate Limit Visualization**: Token bucket status and wait times

**Web Dashboard Routes:**
```
GET  /monitor/queue/status     # Current queue snapshot
GET  /monitor/queue/history    # Processing history
POST /monitor/queue/pause      # Pause queue processing
POST /monitor/queue/retry      # Retry failed items
WS   /monitor/queue/live       # Real-time updates
```

#### 5.4 CLI Debugging Tools
```bash
# Queue inspection commands
npm run queue:status           # Show current queue state
npm run queue:inspect <id>     # Inspect specific queue item
npm run queue:retry <id>       # Retry specific failed item
npm run queue:clear            # Clear completed items
```

**Implementation Plan:**
- **Phase 1**: Create queue monitoring infrastructure with WebSocket support
- **Phase 2**: Build simple web dashboard for queue visualization
- **Phase 3**: Add interactive controls and debugging capabilities
- **Phase 4**: Implement CLI tools for command-line queue management

---

## 6. Real-time Data Viewing System

### **Current State**
- Data only available after batch saves
- No real-time product viewing during scraping
- Limited insight into scraping progress and results

### **Planned Improvements**

#### 6.1 Live Data Streaming
```typescript
export class DataViewManager extends EventEmitter {
  private productStream: ProductStream;
  private webInterface: DataViewAPI;
  
  startDataViewing(port: number = 3002): void {
    // Start real-time data viewing service
  }
  
  streamProduct(product: Product): void {
    // Stream product data to connected clients
    this.emit('product-scraped', product);
    this.productStream.push(product);
  }
}
```

#### 6.2 Real-time Data API
```typescript
export class DataViewAPI {
  // WebSocket endpoints for real-time data
  broadcastProduct(product: Product): void
  
  // REST endpoints for data access
  getRecentProducts(limit: number): Product[]
  getProductsBySite(siteName: string): Product[]
  getProductsByCategory(category: string): Product[]
  searchProducts(query: string): Product[]
}
```

#### 6.3 Live Data Features
- **Real-time Product Feed**: Stream of products as they're scraped
- **Live Statistics**: Running totals, success rates, categories discovered
- **Product Preview**: Quick view of product details without waiting for saves
- **Search & Filter**: Real-time search through accumulated data
- **Export Subsets**: Export filtered data on-demand

**Web Interface Routes:**
```
GET  /data/live/products       # Recent products feed
GET  /data/live/stats          # Live scraping statistics  
GET  /data/search?q=helmet     # Search scraped products
POST /data/export              # Export filtered data
WS   /data/live/stream         # Real-time product stream
```

#### 6.4 Data Visualization Dashboard
- **Progress Charts**: Products scraped over time by site/category
- **Product Gallery**: Visual grid of scraped product images
- **Price Analytics**: Price distribution and trends
- **Category Breakdown**: Pie charts of product categories
- **Site Comparison**: Comparative statistics across sites

**Implementation Plan:**
- **Phase 1**: Implement real-time data streaming infrastructure
- **Phase 2**: Create basic web interface for live data viewing
- **Phase 3**: Add search, filtering, and export capabilities
- **Phase 4**: Build comprehensive dashboard with analytics and visualizations

---

## 🚀 Implementation Timeline

### **Phase 1: Foundation (Week 1-2)**
- [ ] Create JSON configuration system
- [ ] Implement unified logging infrastructure
- [ ] Set up basic real-time monitoring framework

### **Phase 2: Core Features (Week 3-4)**
- [ ] Enhance collection page discovery and queueing
- [ ] Implement automatic dual-format data output
- [ ] Build queue monitoring dashboard

### **Phase 3: Real-time Systems (Week 5-6)**
- [ ] Develop real-time data viewing capabilities
- [ ] Add interactive queue debugging tools
- [ ] Create comprehensive monitoring dashboard

### **Phase 4: Polish & Integration (Week 7-8)**
- [ ] Integrate all systems with existing architecture
- [ ] Add comprehensive error handling and recovery
- [ ] Create documentation and usage guides
- [ ] Performance optimization and testing

---

## 🔧 Technical Considerations

### **Backward Compatibility**
- All changes will maintain existing API compatibility
- Configuration migration scripts for existing setups
- Gradual rollout with feature flags

### **Performance Impact**
- Real-time features will be optional and configurable
- Minimal overhead when monitoring is disabled
- Efficient WebSocket connections with connection pooling

### **Security**
- Web interfaces will include authentication where needed
- Rate limiting on monitoring endpoints
- Secure WebSocket connections in production

### **Testing Strategy**
- Unit tests for all new components
- Integration tests for real-time systems
- Performance benchmarks for monitoring overhead
- End-to-end tests for complete workflows

---

## 📊 Success Metrics

### **Collection Coverage**
- 100% product discovery across all configured categories
- Automatic handling of pagination and subcategories
- Reduced manual intervention for URL management

### **Data Availability**
- Real-time data availability within seconds of scraping
- Simultaneous JSON and SQL output with 99.9% reliability
- Zero data loss during concurrent format writes

### **Operational Efficiency**
- 50% reduction in debugging time through real-time monitoring
- Automated configuration management reducing setup time by 75%
- Consolidated logging improving error resolution by 60%

### **User Experience**
- Real-time visibility into scraping progress and results
- Interactive queue management reducing wait times
- Comprehensive monitoring eliminating blind spots

---

## 🎯 Conclusion

These improvements will transform MotoScrape from a basic scraping tool into a comprehensive, observable, and maintainable web scraping platform. The focus on real-time capabilities, automated processes, and better configuration management will significantly enhance both developer and operational experiences while maintaining the robust, event-driven architecture that makes MotoScrape effective.

Each improvement builds upon the existing codebase with minimal disruption, ensuring a smooth transition and immediate benefits upon implementation.