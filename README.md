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
