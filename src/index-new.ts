/**
 * MotoScrape - Australian Motorcycle Gear Web Scraper
 * Refactored Entry Point with Clean Architecture
 */

import { AppRunner } from "./cli/app-runner.js";

/**
 * Application entry point
 */
async function main() {
  await AppRunner.run();
}

// Run the application if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}