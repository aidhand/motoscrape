# MotoScrape Developer Guide

This guide provides detailed information for developers working on the MotoScrape codebase.

## 🏗️ Architecture Overview

MotoScrape follows a modular, event-driven architecture designed for maintainability and extensibility.

### Core Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Type Safety**: Comprehensive TypeScript usage with strict type checking
3. **Configuration-Driven**: Behavior controlled through external configuration
4. **Error Resilience**: Robust error handling with recovery strategies
5. **Observability**: Comprehensive logging and monitoring

## 📁 Directory Structure

```
src/
├── adapters/           # Site-specific scraping logic
├── config/             # Configuration management system
├── core/               # Core orchestration and management
├── models/             # Data models and validation schemas
├── storage/            # Data persistence layer
├── utils/              # Shared utilities and helpers
├── cli.ts              # Command-line interface
└── index.ts            # Application entry point
```

## 🔧 Key Components

### 1. Scraper Orchestrator (`core/scraper-orchestrator.ts`)

The main coordinator that manages the entire scraping process.

**Responsibilities:**
- Browser pool management
- URL queue coordination
- Rate limiting enforcement
- Event emission for monitoring
- Statistics collection

**Key Methods:**
- `start()`: Initialize and start scraping
- `stop()`: Graceful shutdown
- `addUrls()`: Add URLs to processing queue
- `getStats()`: Retrieve performance statistics

### 2. Adapter System (`adapters/`)

Site-specific scraping implementations that extend `BaseAdapter`.

**BaseAdapter Methods to Implement:**
- `identifyPageType()`: Classify page type (product, collection, etc.)
- `discoverProducts()`: Find product URLs from listing pages
- `extractProduct()`: Extract detailed product information
- `extractProductSummary()`: Extract basic product info from listings
- `canHandle()`: Check if adapter supports a given URL

**Creating New Adapters:**

```typescript
import { BaseAdapter, PageType, ExtractionContext } from './base-adapter.js';

export class MyStoreAdapter extends BaseAdapter {
  async identifyPageType(url: string, page: Page): Promise<PageType> {
    if (url.includes('/products/')) return PageType.PRODUCT;
    if (url.includes('/collections/')) return PageType.COLLECTION;
    return PageType.UNKNOWN;
  }

  async extractProduct(context: ExtractionContext): Promise<Product | null> {
    const { page, url } = context;
    
    // Use helper methods for safe extraction
    const name = await this.safeExtractText(page, 'h1.product-title');
    const price = await this.safeExtractText(page, '.price');
    
    // Return structured product data
    return {
      id: this.generateProductId(url),
      name: name || 'Unknown',
      // ... other fields
    };
  }
  
  // ... implement other required methods
}
```

### 3. Configuration System (`config/`)

Flexible configuration management supporting multiple sources.

**Configuration Hierarchy:**
1. Environment variables
2. External JSON files
3. Default configurations

**Key Classes:**
- `ConfigLoader`: Load configurations from various sources
- `ConfigValidator`: Validate configuration structure
- `defaultAppSettings`: Default application settings
- `siteConfigs`: Predefined site configurations

### 4. Error Handling (`utils/error-handling.ts`)

Standardized error handling with classification and recovery.

**Error Types:**
- `NETWORK`: Network connectivity issues
- `PARSING`: Data extraction failures
- `VALIDATION`: Schema validation errors
- `TIMEOUT`: Operation timeouts
- `RATE_LIMIT`: Rate limiting encountered
- `CONFIGURATION`: Setup/config issues
- `BROWSER`: Browser automation problems

**Usage Example:**

```typescript
import { withRetry, createScrapingError, ErrorType } from '../utils/error-handling.js';

// Automatic retry with exponential backoff
const result = await withRetry(
  () => page.goto(url, { waitUntil: 'networkidle' }),
  maxRetries: 3,
  backoffMs: 1000,
  { url, site: 'example' }
);

// Safe execution with error wrapping
const { success, data, error } = await safeExecute(
  () => extractProductData(page),
  { url, adapter: 'shopify' }
);
```

### 5. Logging System (`utils/logging.ts`)

Centralized logging with contextual information and log levels.

**Usage Example:**

```typescript
import { createLogger } from '../utils/logging.js';

const logger = createLogger('MyComponent');

// Basic logging
logger.info('Processing started', { url, site: 'example' });
logger.warn('Selector not found, using fallback', { selector: '.price' });
logger.error('Failed to extract product', { url, error: error.message });

// Performance timing
await logger.withTiming('extract-product', async () => {
  return await extractProduct(page);
});
```

## 🧪 Testing Strategy

### Unit Tests

Focus on testing individual components in isolation.

**Test File Locations:**
- Core logic: `tests/unit/`
- Mock external dependencies (Playwright, file system)
- Test error conditions and edge cases

**Example Test Structure:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MyAdapter } from '../src/adapters/my-adapter.js';

describe('MyAdapter', () => {
  it('should identify product pages correctly', async () => {
    const adapter = new MyAdapter(mockConfig);
    const mockPage = createMockPage();
    
    const pageType = await adapter.identifyPageType(
      'https://example.com/products/test',
      mockPage
    );
    
    expect(pageType).toBe(PageType.PRODUCT);
  });
});
```

### Integration Tests

Test component interactions and data flow.

### End-to-End Tests

Test complete workflows with real or mock websites.

## 🔄 Development Workflow

### Setting Up Development Environment

```bash
# Clone and setup
git clone https://github.com/aidhand/motoscrape.git
cd motoscrape
pnpm install

# Run type checking
pnpm run typecheck

# Start development with file watching
pnpm run test  # In one terminal
pnpm run typecheck --watch  # In another terminal
```

### Code Quality Checklist

Before submitting changes:

- [ ] TypeScript compilation passes (`pnpm run typecheck`)
- [ ] All tests pass (`pnpm run test:run`)
- [ ] Code is formatted (`pnpm run format`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] New functionality has tests
- [ ] Configuration changes are documented
- [ ] Error handling follows established patterns

### Adding New Features

1. **Design Phase**
   - Identify which components need changes
   - Design interfaces for new functionality
   - Consider error handling and logging

2. **Implementation Phase**
   - Write failing tests first (TDD approach)
   - Implement functionality with proper TypeScript types
   - Add comprehensive error handling
   - Include logging for debugging

3. **Integration Phase**
   - Test with existing components
   - Update configuration schemas if needed
   - Add CLI commands if applicable
   - Update documentation

4. **Validation Phase**
   - Run full test suite
   - Test with real websites (if applicable)
   - Performance testing for critical paths
   - Review error handling under stress

## 📊 Performance Considerations

### Rate Limiting
- Always respect site rate limits
- Use exponential backoff for retries
- Implement circuit breakers for failing sites

### Memory Management
- Process data in batches
- Clear unnecessary page resources
- Monitor browser context memory usage

### Concurrent Processing
- Balance concurrency with respectful scraping
- Use queue prioritization for important URLs
- Implement graceful degradation under load

## 🚨 Common Pitfalls

### 1. Selector Brittleness
Problem: Hard-coded CSS selectors break when sites change.

Solution: Use fallback selectors and configuration-driven selection.

```typescript
// Bad
const price = await page.$eval('.price', el => el.textContent);

// Good
const priceSelectors = [
  this.siteConfig.selectors.price,
  '.price',
  '[data-price]',
  '.product-price'
];

const price = await this.safeExtractText(page, priceSelectors.join(', '));
```

### 2. Insufficient Error Handling
Problem: Unhandled errors crash the scraper.

Solution: Use comprehensive error wrapping and classification.

```typescript
// Bad
const product = await extractProduct(page);

// Good
const result = await safeExecute(
  () => extractProduct(page),
  { url, adapter: this.constructor.name }
);

if (!result.success) {
  this.logger.error('Product extraction failed', {
    url,
    error: result.error.message,
    recoverable: result.error.recoverable
  });
  return null;
}
```

### 3. Configuration Hardcoding
Problem: Site-specific logic embedded in code.

Solution: Use configuration-driven approach.

```typescript
// Bad
if (url.includes('motoheaven')) {
  // Specific logic
}

// Good
const siteConfig = this.siteConfig;
const selectors = siteConfig.selectors;
```

## 🔧 Debugging Tips

### 1. Logging Levels
Use appropriate log levels for different types of information:

```typescript
logger.debug('Detailed execution flow');  // Development only
logger.info('Important milestones');      // Normal operation
logger.warn('Potential issues');          // Concerning but not fatal
logger.error('Failures requiring attention'); // Requires investigation
```

### 2. Browser Debugging
Enable visual debugging for development:

```json
{
  "global_settings": {
    "headless": false,
    "log_level": "debug"
  }
}
```

### 3. Configuration Validation
Always validate configuration before use:

```bash
pnpm run cli config:validate ./my-config/app-settings.json
```

## 📈 Extending the System

### Adding New Site Types

1. Create new adapter extending `BaseAdapter`
2. Register adapter type in `adapter-registry.ts`
3. Add configuration schema extensions if needed
4. Create comprehensive tests
5. Document site-specific quirks

### Adding New Data Fields

1. Update `ProductSchema` in `models/product.ts`
2. Update extraction logic in relevant adapters
3. Add validation rules
4. Update tests and documentation

### Adding New Storage Formats

1. Implement new storage adapter in `storage/`
2. Add format option to configuration schema
3. Update orchestrator to use new format
4. Add tests for new format

This guide should help you navigate and extend the MotoScrape codebase effectively. For specific questions or issues, refer to the existing code examples and test files.