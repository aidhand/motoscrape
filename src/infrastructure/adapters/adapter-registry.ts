import { BaseAdapter } from "./base-adapter.js";
import { ShopifyAdapter } from "./shopify-adapter.js";
import { MCASAdapter } from "./mcas-adapter.js";
import { GenericAdapter } from "./generic-adapter.js";
import { SiteConfig } from "../models/site-config.js";

/**
 * Registry for managing site-specific adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  /**
   * Register an adapter for a specific site
   */
  registerAdapter(siteName: string, adapter: BaseAdapter): void {
    this.adapters.set(siteName, adapter);
    console.log(
      `Registered adapter for site: ${siteName} (${adapter.getAdapterType()})`
    );
  }

  /**
   * Get adapter for a specific site
   */
  getAdapter(siteName: string): BaseAdapter | null {
    return this.adapters.get(siteName) || null;
  }

  /**
   * Find adapter that can handle a specific URL
   */
  findAdapterForUrl(url: string): BaseAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get all registered site names
   */
  getRegisteredSites(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Create and register adapters from site configurations
   */
  registerFromConfigs(siteConfigs: SiteConfig[]): void {
    for (const config of siteConfigs) {
      let adapter: BaseAdapter | null = null;

      switch (config.adapter_type) {
        case "shopify":
          adapter = new ShopifyAdapter(config);
          break;
        case "mcas":
          adapter = new MCASAdapter(config);
          break;
        case "generic":
          adapter = new GenericAdapter(config);
          break;
        default:
          console.warn(
            `Unknown adapter type: ${config.adapter_type} for site ${config.name}, using generic adapter`
          );
          // Use generic adapter as fallback
          adapter = new GenericAdapter(config);
      }

      if (adapter) {
        this.registerAdapter(config.name, adapter);
      }
    }
  }

  /**
   * Clear all registered adapters
   */
  clear(): void {
    this.adapters.clear();
  }
}

// Export singleton instance
export const adapterRegistry = new AdapterRegistry();
