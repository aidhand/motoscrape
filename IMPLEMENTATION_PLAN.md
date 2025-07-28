# MotoScrape - Australian Motorcycle Gear Web Scraper

## Project Overview

A TypeScript-based web crawler/scraper designed specifically for extracting product information from Australian motorcycle gear websites. Built with Playwright for robust browser automation and Zod for data validation.

## Target Websites

### Primary Targets

- **MotoHeaven** (motoheaven.com.au) - Shopify-based platform
- **MCAS** (mcas.com.au) - Custom e-commerce platform
- **BikeBiz** - Additional Australian motorcycle retailer

### Data Extraction Requirements

1. **Product Details**: Name, brand, SKU, category, subcategory
2. **Pricing**: Regular price, sale price, discount percentage, currency (AUD)
3. **Availability**: Stock status, quantity, backorder information
4. **Variants**: Sizes, colors, styles with individual pricing/availability
5. **Media**: Product images, videos, technical diagrams
6. **Specifications**: Detailed descriptions, features, certifications, size charts
7. **Compatibility**: Motorcycle make/model compatibility
8. **Reviews**: Ratings and review counts where available

## Architecture Overview

```
src/
├── core/
│   ├── browser-manager.ts      # Playwright browser pool management
│   ├── queue-manager.ts        # URL queue and job management
│   ├── rate-limiter.ts         # Rate limiting and anti-detection
│   └── data-validator.ts       # Zod schema validation
├── adapters/
│   ├── base-adapter.ts         # Abstract base class for site adapters
│   ├── shopify-adapter.ts      # MotoHeaven and Shopify sites
│   ├── mcas-adapter.ts         # MCAS custom platform
│   └── generic-adapter.ts      # Fallback for unknown sites
├── models/
│   ├── product.ts              # Product data schemas
│   ├── variant.ts              # Product variant schemas
│   └── site-config.ts          # Site configuration schemas
├── utils/
│   ├── selectors.ts            # CSS selectors and extraction helpers
│   ├── data-normalizer.ts      # Data cleaning and normalization
│   └── image-processor.ts      # Image download and processing
├── storage/
│   ├── json-storage.ts         # JSON file storage
│   ├── sqlite-storage.ts       # SQLite database storage
│   └── csv-exporter.ts         # CSV export functionality
├── tests/
│   ├── unit/                   # Unit tests with Vitest
│   ├── integration/            # Integration tests with fixtures
│   ├── fixtures/               # Test data and mock responses
│   └── helpers/                # Test utilities and setup
├── maintenance/
│   ├── selector-verifier.ts    # AI-powered selector validation
│   ├── stagehand-adapter.ts    # Stagehand integration for automation
│   ├── health-checker.ts       # Site health monitoring
│   ├── auto-updater.ts         # Self-healing selector updates
│   └── monitoring-dashboard.ts # Real-time monitoring interface
└── config/
    ├── sites.json              # Site-specific configurations
    └── settings.json           # Global scraper settings
```

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)

- ✅ Set up Playwright browser management
- ✅ Create basic data models with Zod schemas
- ✅ Implement queue system for URL management
- ✅ Basic rate limiting and retry mechanisms

### Phase 2: Site Adapters (Weeks 3-4)

- 🔄 Implement Shopify adapter (MotoHeaven)
- 🔄 Implement MCAS custom adapter
- 🔄 Generic fallback adapter
- 🔄 Data validation and normalization

### Phase 3: Advanced Features (Weeks 5-6)

- ⏳ Anti-detection measures
- ⏳ Image processing and storage
- ⏳ Configuration management system
- ⏳ Monitoring and logging

### Phase 4: Polish & Testing (Weeks 7-8)

- ⏳ Comprehensive Vitest testing suite with TypeScript support
- ⏳ Test coverage reporting and quality gates
- ⏳ Performance optimization with benchmarking
- ⏳ Documentation and examples
- ⏳ Error handling edge cases with mock scenarios

### Phase 5: Maintenance & Automation Tooling (Weeks 9-10)

- ⏳ AI-powered selector verification and updating system
- ⏳ Stagehand integration for automated browser interactions
- ⏳ Automated health checks and site change detection
- ⏳ Self-healing scraper capabilities with ML-based adaptations
- ⏳ Monitoring dashboard with real-time alerts
- ⏳ Automated testing of site adapters against live sites
- ⏳ Configuration drift detection and automatic corrections

## Key Features

### Anti-Detection Measures

- Browser stealth techniques using Playwright
- Randomized user agents and browser fingerprints
- Human-like behavior patterns (mouse movements, typing delays)
- Session management and cookie handling
- Proxy rotation for distributed scraping

### Rate Limiting & Politeness

- Respect robots.txt files
- 2-5 second delays between requests
- Limit concurrent requests per domain
- Monitor for rate limiting responses
- Exponential backoff for retries

### Data Processing Pipeline

- **Discovery Phase**: Sitemap parsing, category crawling, search-based discovery
- **Extraction Phase**: Product page scraping with retry mechanisms
- **Processing Phase**: Data normalization, duplicate detection, price analysis
- **Storage Phase**: Multiple output formats (JSON, CSV, SQLite, PostgreSQL)

### Australian Market Considerations

1. **Currency**: All prices in AUD with proper formatting
2. **Safety Standards**: Extract certification information (CE, DOT, ECE)
3. **Sizing**: Australian-specific size charts and conversions
4. **Shipping**: Local shipping costs and delivery timeframes
5. **Brands**: Focus on popular Australian motorcycle gear brands
6. **Seasonal**: Handle seasonal variations and clearance cycles

## Data Models

### Core Product Schema

```typescript
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  sku: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  price: z.object({
    regular: z.number(),
    sale: z.number().optional(),
    currency: z.literal("AUD"),
    discount_percentage: z.number().optional(),
  }),
  availability: z.object({
    in_stock: z.boolean(),
    quantity: z.number().optional(),
    stock_status: z.enum(["in_stock", "out_of_stock", "backorder", "preorder"]),
  }),
  variants: z.array(VariantSchema).optional(),
  images: z.array(z.string()),
  description: z.object({
    short: z.string().optional(),
    full: z.string().optional(),
    features: z.array(z.string()).optional(),
    specifications: z.record(z.string()).optional(),
  }),
  certifications: z.array(z.string()).optional(),
  compatibility: z
    .object({
      vehicle_types: z.array(z.string()).optional(),
      makes: z.array(z.string()).optional(),
      models: z.array(z.string()).optional(),
    })
    .optional(),
  metadata: z.object({
    scraped_at: z.date(),
    source_url: z.string(),
    site: z.string(),
  }),
});
```

## Configuration Example

```json
{
  "sites": {
    "motoheaven": {
      "base_url": "https://motoheaven.com.au",
      "adapter_type": "shopify",
      "rate_limit": {
        "requests_per_minute": 30,
        "delay_between_requests": 2000
      },
      "categories": ["helmets", "road-gear", "off-road", "motorcycle-parts"],
      "selectors": {
        "product_name": "h1[data-testid='product-title']",
        "price": "[data-testid='price']",
        "stock_status": "[data-testid='inventory-status']"
      }
    }
  },
  "global_settings": {
    "headless": true,
    "timeout": 30000,
    "max_retries": 3,
    "output_format": "json",
    "image_download": true,
    "ai_config": {
      "primary_provider": "openai",
      "models": {
        "selector_analysis": "gpt-4-vision-preview",
        "text_extraction": "gpt-4o",
        "health_monitoring": "gpt-4o-mini"
      },
      "fallback_providers": ["anthropic", "google"]
    }
  }
}
```

## Success Metrics

- **Data Accuracy**: 98%+ accuracy for extracted product information
- **Coverage**: Successfully extract data from 95%+ of target product pages
- **Performance**: Process 1000+ products per hour per site
- **Reliability**: Handle rate limiting and anti-bot measures gracefully
- **Maintainability**: Easy addition of new motorcycle gear websites

## Testing Strategy

Built with **Vitest** for fast, modern testing with native TypeScript support:

- **Unit tests** for data extraction functions using Vitest's fast test runner
- **Integration tests** with real sites (using fixtures and Vitest's mocking capabilities)
- **Performance tests** for large-scale scraping with Vitest's benchmarking features
- **Data quality validation tests** using Vitest assertions and custom matchers
- **Error handling and recovery tests** with Vitest's comprehensive error testing utilities

### Testing Framework Benefits

- **Fast execution** with Vitest's native ESM support and parallel test running
- **TypeScript integration** without additional configuration
- **Mock utilities** for browser automation and network requests
- **Snapshot testing** for data structure validation
- **Coverage reporting** with built-in c8 integration

## Maintenance & Automation Strategy

### AI-Powered Selector Management

**Provider-Agnostic AI Integration**: Uses Vercel's `ai` package to support multiple AI providers (OpenAI, Anthropic, Google, etc.) for intelligent selector discovery and validation:

- **Automatic Selector Discovery**: Use AI models to identify optimal selectors when sites change layouts
- **Visual Element Recognition**: Multi-modal AI identification of product elements even when CSS classes change
- **Fallback Selector Generation**: Generate multiple selector strategies for resilient data extraction
- **Cross-browser Compatibility**: Ensure selectors work across different browser engines
- **Model Flexibility**: Switch between AI providers based on performance, cost, or availability

**Stagehand Integration**: Combine with Stagehand's browser automation for seamless AI-driven interactions

### Self-Healing Capabilities

- **Real-time Validation**: Continuous monitoring of selector effectiveness across all target sites
- **Intelligent Adaptation**: Machine learning models that learn from successful extractions
- **Automatic Rollback**: Revert to previous working configurations when updates fail
- **Change Impact Analysis**: Assess the scope of site changes and recommend appropriate responses

### Monitoring & Alerting

- **Site Change Detection**: Monitor DOM structure changes and layout modifications
- **Performance Degradation Alerts**: Track extraction success rates and response times
- **Data Quality Monitoring**: Validate extracted data against expected schemas and patterns
- **Compliance Monitoring**: Ensure continued adherence to robots.txt and rate limiting rules

### Maintenance Dashboard Features

- **Visual Selector Editor**: GUI for updating and testing selectors without code changes
- **Site Health Overview**: Real-time status of all monitored e-commerce sites
- **Extraction Analytics**: Success rates, performance metrics, and trend analysis
- **Configuration Management**: Version control and rollback capabilities for site configurations
- **Automated Reporting**: Daily/weekly reports on scraper health and data quality

## Usage Examples

### Basic Scraping

```typescript
import { MotoScraper } from "./src/core/scraper";

const scraper = new MotoScraper({
  sites: ["motoheaven", "mcas"],
  categories: ["helmets", "jackets"],
  output: "data/products.json",
});

await scraper.run();
```

### Advanced Configuration

```typescript
const scraper = new MotoScraper({
  sites: [
    {
      name: "motoheaven",
      categories: ["helmets"],
      filters: {
        price_max: 500,
        brands: ["Shoei", "Arai"],
      },
    },
  ],
  options: {
    headless: false,
    concurrent: 2,
    delay: 3000,
  },
});
```

### Maintenance Tooling Examples

```typescript
import { SelectorVerifier, StagehandAdapter } from "./src/maintenance";
import { openai } from "ai/providers/openai";
import { anthropic } from "ai/providers/anthropic";

// AI-powered selector verification with provider flexibility
const verifier = new SelectorVerifier({
  aiModel: openai("gpt-4-vision-preview"), // or anthropic("claude-3-sonnet")
  stagehandConfig: {
    browserContext: "desktop",
    fallbackStrategies: ["css", "xpath", "visual"],
  },
});

// Verify and update selectors for a site
await verifier.validateSite("motoheaven", {
  autoUpdate: true,
  confidence: 0.8,
});

// Monitor site health with AI-powered analysis
import { HealthChecker } from "./src/maintenance";

const monitor = new HealthChecker({
  sites: ["motoheaven", "mcas"],
  aiModel: openai("gpt-4o"), // Provider agnostic model selection
  checkInterval: "1h",
  alertWebhook: "https://hooks.slack.com/...",
});

await monitor.start();
```

## Development Setup

1. **Install Dependencies**

   ```bash
   pnpm install
   pnpm add -D vitest @vitest/ui c8
   pnpm add @stagehand/core ai
   ```

2. **Run Development**

   ```bash
   pnpm run start
   ```

3. **Run Tests**

   ```bash
   pnpm run test
   ```

4. **Lint and Format**

   ```bash
   pnpm run lint
   pnpm run format
   ```

## Legal & Ethical Considerations

1. Only scrape publicly available data
2. Respect terms of service where possible
3. Don't overload servers - scrape during off-peak hours
4. Cache data to minimize repeated requests
5. Provide clear attribution and contact information
6. Implement proper rate limiting and politeness policies

## License

This project is for educational and research purposes. Please ensure compliance with website terms of service and applicable laws when using this software.
