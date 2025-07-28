import { ScraperOrchestrator } from './src/core/scraper-orchestrator.js';
import { motoheavenConfig } from './src/index.js';
import { AppSettings } from './src/core/configuration-manager.js';

const appSettings: AppSettings = {
  max_concurrent_requests: 2,
  request_delay: 3000,
  storage: { format: 'json', output_directory: './data' },
  monitoring: { enabled: true }
};

const scraper = new ScraperOrchestrator(appSettings, [motoheavenConfig]);

// Test with just one product URL
await scraper.addUrl({
  url: 'https://www.motoheaven.com.au/collections/motorcycle-helmets/products/agv-pista-gp-rr-catalunya-2008-limited-edition-helmet',
  siteName: 'motoheaven',
  priority: 1
});

console.log('Starting test scrape of single MotoHeaven product...');
await scraper.start();
console.log('Test complete!');
process.exit(0);
