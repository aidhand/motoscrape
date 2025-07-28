# MotoScrape 🏍️

A high-performance TypeScript web scraper designed specifically for Australian motorcycle gear websites. Built with Playwright, featuring intelligent rate limiting, queue management, and browser automation with anti-detection capabilities.

## 🎯 Features

- **Multi-site Support**: Configurable adapters for different e-commerce platforms (Shopify, MCAS, custom)
- **Intelligent Rate Limiting**: Site-specific and global rate limiting with token bucket algorithm
- **Queue Management**: Priority-based URL processing with retry logic and exponential backoff
- **Browser Management**: Automated browser pool with stealth capabilities and human behavior simulation
- **Australian Focus**: Pre-configured for major Australian motorcycle gear retailers
- **Type Safety**: Full TypeScript implementation with Zod schema validation
- **Performance**: Built with Node.js and optimized for speed

## 🏗️ Architecture

### Core Components

1. **Browser Manager** (`src/core/browser-manager.ts`)
   - Playwright browser automation
   - Context isolation per site
   - Anti-detection measures
   - Human behavior simulation

2. **Queue Manager** (`src/core/queue-manager.ts`)
   - Priority-based URL processing
   - Retry logic with exponential backoff
   - Concurrent processing limits
   - Event-driven architecture

3. **Rate Limiter** (`src/core/rate-limiter.ts`)
   - Token bucket algorithm
   - Site-specific configurations
   - Global rate limiting
   - Burst protection

4. **Scraper Orchestrator** (`src/core/scraper-orchestrator.ts`)
   - Main coordination component
   - Event system for monitoring
   - Statistics tracking
   - Graceful error handling

### Data Models

- **Product Schema** (`src/models/product.ts`): Complete product data structure with Australian-specific fields
- **Variant Schema** (`src/models/variant.ts`): Product variations (size, color, material)
- **Site Configuration** (`src/models/site-config.ts`): Site-specific scraping configurations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (recommended: use latest LTS)
- pnpm (package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/aidhand/motoscrape.git
cd motoscrape

# Install dependencies
pnpm install

# Initialize configuration (optional)
pnpm run cli config:init ./config
```

### Configuration

MotoScrape uses a flexible configuration system that supports both file-based and environment-based configuration.

#### Option 1: Environment Variables (Recommended)

```bash
# Set configuration file paths
export MOTOSCRAPE_APP_CONFIG=/path/to/app-settings.json
export MOTOSCRAPE_SITE_CONFIGS=/path/to/site-configs.json

# Or use default configurations (no setup required)
pnpm start
```

#### Option 2: File-based Configuration

```bash
# Generate configuration templates
pnpm run cli config:init ./my-config

# Validate your configuration
pnpm run cli config:validate ./my-config/app-settings.json ./my-config/site-configs.json

# List available site configurations
pnpm run cli config:list
```

#### Configuration Structure

**App Settings** (`app-settings.json`):
```json
{
  "global_settings": {
    "headless": true,
    "timeout": 30000,
    "max_retries": 3,
    "max_concurrent_requests": 3,
    "delay_between_requests": 1000,
    "max_requests_per_minute": 60,
    "output_format": "json",
    "output_directory": "./data",
    "log_level": "info"
  },
  "browser_settings": {
    "viewport": { "width": 1920, "height": 1080 },
    "user_agent": "Mozilla/5.0...",
    "locale": "en-AU",
    "timezone": "Australia/Sydney"
  }
}
```

**Site Configurations** (`site-configs.json`):
```json
{
  "sites": [
    {
      "name": "motoheaven",
      "base_url": "https://www.motoheaven.com.au",
      "adapter_type": "shopify",
      "rate_limit": {
        "requests_per_minute": 30,
        "delay_between_requests": 5000,
        "concurrent_requests": 6
      },
      "categories": ["helmets", "jackets", "gloves"],
      "selectors": {
        "product_container": ".product-item",
        "product_name": ".product-item__product-title",
        "price": ".product-item__price-main"
      },
      "navigation": {
        "category_urls": {
          "helmets": "/collections/helmets",
          "jackets": "/collections/jackets"
        }
      }
    }
  ]
}
```

### Running the Scraper

```bash
# Start scraping with default configuration
pnpm start

# Or use CLI for configuration management
pnpm run cli help
```

## 🛠️ Development

### Code Organization

The codebase follows a modular architecture designed for maintainability:

```
src/
├── adapters/           # Site-specific scrapers
│   ├── base-adapter.ts     # Abstract base class
│   ├── shopify-adapter.ts  # Shopify platform adapter
│   └── mcas-adapter.ts     # MCAS platform adapter
├── config/             # Configuration management
│   ├── app-settings.ts     # Default app settings
│   ├── site-configs.ts     # Site configurations
│   └── config-loader.ts    # Configuration loading logic
├── core/               # Core scraping logic
│   ├── scraper-orchestrator.ts  # Main coordinator
│   ├── browser-manager.ts       # Browser automation
│   ├── queue-manager.ts         # URL queue management
│   └── rate-limiter.ts          # Rate limiting
├── models/             # Data models and schemas
│   ├── product.ts          # Product data structure
│   ├── variant.ts          # Product variant structure
│   └── site-config.ts      # Configuration schemas
├── storage/            # Data persistence
├── utils/              # Shared utilities
│   ├── error-handling.ts   # Standardized error handling
│   ├── logging.ts          # Centralized logging
│   └── data-normalizer.ts  # Data processing
├── cli.ts              # Command-line interface
└── index.ts            # Main entry point
```

### Development Workflow

```bash
# Type checking
pnpm run typecheck

# Linting and formatting
pnpm run lint
pnpm run format

# Running tests
pnpm run test           # Watch mode
pnpm run test:run      # Single run
pnpm run test:ui       # UI mode

# Configuration management
pnpm run cli config:init     # Initialize config templates
pnpm run cli config:validate # Validate configurations
pnpm run cli config:list     # List available sites
```

### Key Maintainability Features

1. **Type Safety**: Full TypeScript with strict mode enabled
2. **Configuration Management**: Externalized, validated configurations
3. **Error Handling**: Standardized error types with recovery strategies  
4. **Logging**: Structured logging with contextual information
5. **Modular Architecture**: Clear separation of concerns
6. **Testing**: Comprehensive unit test coverage
7. **Documentation**: JSDoc comments throughout codebase

### Adding New Sites

1. Create site configuration in `site-configs.ts` or external JSON file
2. Choose appropriate adapter type (`shopify`, `mcas`, or `generic`)
3. Configure selectors for data extraction
4. Test with `pnpm run cli config:validate`
5. Run scraper to verify functionality

### Error Handling

The scraper uses a sophisticated error handling system:

```typescript
import { withRetry, createScrapingError, ErrorType } from './utils/error-handling.js';

// Automatic retry with exponential backoff
const result = await withRetry(
  () => page.goto(url),
  maxRetries: 3,
  backoffMs: 1000,
  { url, site: 'motoheaven' }
);
```

Error types are classified and handled appropriately:
- `NETWORK`: Temporary network issues (recoverable)
- `RATE_LIMIT`: Rate limiting hit (recoverable with delay)
- `PARSING`: Data extraction failures (may be recoverable)
- `CONFIGURATION`: Setup issues (not recoverable)
- `VALIDATION`: Data validation failures (not recoverable)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd motoscrape

# Install dependencies
pnpm install

# Install Playwright browsers
pnpm run postinstall:playwright
```

### Basic Usage

```typescript
import { ScraperOrchestrator } from "./core/index.js";
import { appSettings, motoheavenConfig } from "./example.js";

// Create scraper instance
const scraper = new ScraperOrchestrator(appSettings, [motoheavenConfig]);

// Start scraping
await scraper.start();

// Add URLs to process
scraper.addUrls([
  {
    url: "https://www.motoheaven.com.au/collections/helmets",
    siteName: "motoheaven",
  },
]);
```

### Run the Example

```bash
# Run the example scraper
pnpm run start

# Or run the example directly
pnpm run src/example.ts
```

## ⚙️ Configuration

### Application Settings

```typescript
const appSettings = {
  global_settings: {
    headless: true,
    timeout: 30000,
    max_retries: 3,
    max_concurrent_requests: 3,
    delay_between_requests: 1000,
    max_requests_per_minute: 60,
    output_format: "json",
    output_directory: "./data",
    image_download: false,
    log_level: "info",
  },
  browser_settings: {
    viewport: { width: 1920, height: 1080 },
    locale: "en-AU",
    timezone: "Australia/Sydney",
  },
};
```

### Site Configuration

```typescript
const siteConfig = {
  name: "motoheaven",
  base_url: "https://www.motoheaven.com.au",
  adapter_type: "shopify",
  rate_limit: {
    requests_per_minute: 30,
    delay_between_requests: 2000,
    concurrent_requests: 2,
  },
  selectors: {
    product_container: ".product-item",
    product_name: ".product-item__title",
    price: ".price__current",
    // ... more selectors
  },
  // ... more configuration
};
```

## 🔍 Selector Verification

The project includes tools to verify that CSS selectors work correctly with target websites:

### Verified MotoHeaven Selectors

✅ **Successfully tested selectors (January 2025):**

```typescript
const motoheavenSelectors = {
  product_container: ".product-item", // 50 products found
  product_name: ".product-item__product-title", // Product names extracted
  price: ".product-item__price-main", // Handles both regular & sale prices
  brand: ".product-item__product-vendor", // Brand names (e.g., "AGV")
  images: ".product-item__image img", // Product images
};
```

**Sample extraction result:**

- **Name**: "AGV Pista GP RR Catalunya 2008 Limited Edition Helmet"
- **Prices**: Regular $2,199.00, Sale $2,089.00 (-5%)
- **Brand**: "AGV"
- **Image**: Full URL with proper sizing parameters

### Running Selector Verification

```bash
# Verify selectors against live website
npm run verify-selectors

# Test complete scraping pipeline
npm run test-scraping
```

**Note**: Stock status selectors may not be available on collection pages and are typically found on individual product pages.

## 🎛️ Supported Sites

### Pre-configured Sites

1. **MotoHeaven** (Shopify-based)
   - Categories: Helmets, Jackets, Gloves, Boots, Pants, Accessories
   - Rate limit: 30 requests/minute
   - Concurrent: 2 requests

2. **MCAS** (Custom platform)
   - Categories: Helmets, Clothing, Gloves, Boots
   - Rate limit: 20 requests/minute
   - Concurrent: 1 request

### Adding New Sites

To add support for a new site:

1. Create a site configuration using `SiteConfigSchema`
2. Define appropriate CSS selectors for data extraction
3. Set rate limiting parameters based on site's robots.txt
4. Add to the scraper orchestrator configuration

## 🔍 Data Extraction

### Product Information

The scraper extracts comprehensive product data:

- **Basic Info**: Name, brand, category, SKU
- **Pricing**: Regular price, sale price, discount percentage
- **Availability**: Stock status, quantity
- **Variants**: Size, color, material options
- **Images**: Product photos and thumbnails
- **Specifications**: Technical details and features
- **Australian Specific**:
  - Certifications (AS/NZS standards)
  - Compliance information
  - ADR approval status
  - Local shipping details

### Data Schema

```typescript
interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: {
    regular: number;
    sale?: number;
    currency: "AUD";
    discount_percentage?: number;
  };
  availability: {
    in_stock: boolean;
    quantity?: number;
    stock_status: "in_stock" | "out_of_stock" | "backorder" | "preorder";
  };
  variants?: ProductVariant[];
  images: string[];
  // ... more fields
}
```

## 🛠️ Development

### Available Scripts

```bash
# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Code formatting
pnpm run format

# Start the scraper
pnpm run start


```

### Project Structure

```
src/
├── core/                 # Core scraper infrastructure
│   ├── browser-manager.ts
│   ├── queue-manager.ts
│   ├── rate-limiter.ts
│   ├── scraper-orchestrator.ts
│   └── index.ts
├── models/              # Data schemas
│   ├── product.ts
│   ├── variant.ts
│   └── site-config.ts
├── example.ts           # Usage examples
└── index.ts            # Main entry point
```

## 📊 Monitoring & Statistics

The scraper provides comprehensive monitoring:

- **Processing Stats**: Success/failure rates, processing times
- **Queue Status**: Pending, processing, completed items
- **Rate Limiting**: Token usage, wait times
- **Performance**: Uptime, throughput, error rates

## 🔧 Advanced Configuration

### Rate Limiting

Configure site-specific rate limits:

```typescript
// Conservative approach
rate_limit: {
  requests_per_minute: 20,
  delay_between_requests: 3000,
  concurrent_requests: 1
}

// Aggressive approach (use carefully)
rate_limit: {
  requests_per_minute: 60,
  delay_between_requests: 1000,
  concurrent_requests: 3
}
```

### Anti-Detection

Built-in anti-detection measures:

- User agent rotation
- Human behavior simulation
- Request timing randomization
- Browser fingerprint masking
- IP rotation (when configured)

## 🚦 Best Practices

1. **Respect robots.txt**: Always check site policies before scraping
2. **Rate Limiting**: Start conservative, monitor server responses
3. **Error Handling**: Implement proper retry logic and fallbacks
4. **Data Quality**: Validate extracted data using Zod schemas
5. **Monitoring**: Use event system to track scraper health
6. **Resource Management**: Properly close browsers and contexts

## 📄 License

This project is for educational and research purposes. Ensure compliance with website terms of service and applicable laws before use.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `pnpm run typecheck` and `pnpm run lint`
6. Submit a pull request

## ⚠️ Disclaimer

This tool is designed for legitimate data collection purposes. Users are responsible for:

- Complying with website terms of service
- Respecting rate limits and server resources
- Following applicable laws and regulations
- Using data responsibly and ethically

---

Built with ❤️ for the Australian motorcycle community
