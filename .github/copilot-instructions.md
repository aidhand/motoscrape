# MotoScrape AI Agent Instructions

## 🏗️ Architecture Overview

MotoScrape is a modular TypeScript scraper with clear component separation:

- **Core** (`core/`): Orchestrates scraping via `ScraperOrchestrator`, managing `BrowserManager` (Playwright), `QueueManager`, and `RateLimiter`
- **Adapters** (`adapters/`): Site-specific logic (Shopify, MCAS, generic) - register in `adapter-registry.ts`
- **Models** (`models/`): Data structures with Zod validation
- **Utils** (`utils/`): Shared utilities like image processing

## 🛠️ Key Patterns

### Event-Driven Processing

Components communicate via events:

```typescript
scraper.on("url-processed", (result) => {
  /* handle */
});
scraper.on("urls-added", (count) => {
  /* update */
});
```

### Configuration-Driven Scraping

Site behavior defined in `SiteConfigSchema` (see `models/site-config.ts`). Add sites by creating config objects:

```typescript
const newSiteConfig = SiteConfigSchema.parse({
  name: "new-site",
  base_url: "https://new-site.com",
  adapter_type: "shopify",
  // ...
});
```

### Adapter Pattern

Extend `BaseAdapter` and register in `adapter-registry.ts`:

```typescript
// adapters/new-site-adapter.ts
import { NewSiteAdapter } from "./new-site-adapter.js";
this.registerAdapter("new-site", new NewSiteAdapter(config));
```

## 🧪 Development Workflow

### Essential Commands

- `pnpm run start` - Launch scraper
- `pnpm run typecheck` - Verify types
- `pnpm run lint` - Check code quality
- `pnpm run format` - Auto-format code

### Testing Focus

- Adapter logic and data extraction
- Real URL testing where possible
- Rate limiting/error recovery scenarios

## ⚠️ Critical Considerations

### Anti-Detection

- Use `AntiDetectionManager` (Playwright stealth)
- Respect `anti_detection` config settings
- Simulate human behavior patterns

### Rate Limiting

- Honor site-specific and global limits (`rate-limiter.ts`)
- Never bypass throttling mechanisms

### Australian Focus

- Prioritize AU retailers
- Use AU user agents/timezone (Australia/Sydney)
