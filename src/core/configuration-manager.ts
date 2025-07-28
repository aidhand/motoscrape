import { promises as fs } from "fs";
import path from "path";
import {
  AppSettings,
  SiteConfig,
  AppSettingsSchema,
  SiteConfigSchema,
} from "../models/site-config.js";

export interface GlobalConfiguration {
  app_settings: AppSettings;
  sites: Record<string, SiteConfig>;
  last_updated: Date;
  version: string;
}

/**
 * Configuration management system
 */
export class ConfigurationManager {
  private configPath: string;
  private sitesPath: string;
  private config: GlobalConfiguration | null = null;

  constructor(configDir: string = "./config") {
    this.configPath = path.join(configDir, "settings.json");
    this.sitesPath = path.join(configDir, "sites.json");
  }

  /**
   * Load configuration from files
   */
  async loadConfiguration(): Promise<GlobalConfiguration> {
    if (this.config) {
      return this.config;
    }

    try {
      await this.ensureConfigDirectory();

      // Load app settings
      const appSettings = await this.loadAppSettings();

      // Load site configurations
      const sites = await this.loadSiteConfigurations();

      this.config = {
        app_settings: appSettings,
        sites,
        last_updated: new Date(),
        version: "1.0.0",
      };

      return this.config;
    } catch (error) {
      console.error(
        "Failed to load configuration:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Load application settings
   */
  private async loadAppSettings(): Promise<AppSettings> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      const data = JSON.parse(content);
      return AppSettingsSchema.parse(data);
    } catch {
      console.warn("App settings not found or invalid, creating defaults...");
      const defaultSettings = this.createDefaultAppSettings();
      await this.saveAppSettings(defaultSettings);
      return defaultSettings;
    }
  }

  /**
   * Load site configurations
   */
  private async loadSiteConfigurations(): Promise<Record<string, SiteConfig>> {
    try {
      const content = await fs.readFile(this.sitesPath, "utf-8");
      const data = JSON.parse(content);

      // Validate each site configuration
      const sites: Record<string, SiteConfig> = {};
      for (const [siteName, siteData] of Object.entries(data.sites || data)) {
        try {
          sites[siteName] = SiteConfigSchema.parse(siteData);
        } catch (error) {
          console.warn(
            `Invalid configuration for site ${siteName}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      return sites;
    } catch {
      console.warn(
        "Site configurations not found or invalid, creating defaults..."
      );
      const defaultSites = this.createDefaultSiteConfigurations();
      await this.saveSiteConfigurations(defaultSites);
      return defaultSites;
    }
  }

  /**
   * Save application settings
   */
  async saveAppSettings(settings: AppSettings): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      const content = JSON.stringify(settings, null, 2);
      await fs.writeFile(this.configPath, content, "utf-8");

      if (this.config) {
        this.config.app_settings = settings;
        this.config.last_updated = new Date();
      }
    } catch (error) {
      console.error(
        "Failed to save app settings:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Save site configurations
   */
  async saveSiteConfigurations(
    sites: Record<string, SiteConfig>
  ): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      const content = JSON.stringify({ sites }, null, 2);
      await fs.writeFile(this.sitesPath, content, "utf-8");

      if (this.config) {
        this.config.sites = sites;
        this.config.last_updated = new Date();
      }
    } catch (error) {
      console.error(
        "Failed to save site configurations:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Add or update a site configuration
   */
  async updateSiteConfiguration(
    siteName: string,
    siteConfig: SiteConfig
  ): Promise<void> {
    const config = await this.loadConfiguration();
    config.sites[siteName] = siteConfig;
    await this.saveSiteConfigurations(config.sites);
  }

  /**
   * Remove a site configuration
   */
  async removeSiteConfiguration(siteName: string): Promise<void> {
    const config = await this.loadConfiguration();
    delete config.sites[siteName];
    await this.saveSiteConfigurations(config.sites);
  }

  /**
   * Get configuration for a specific site
   */
  async getSiteConfiguration(siteName: string): Promise<SiteConfig | null> {
    const config = await this.loadConfiguration();
    return config.sites[siteName] || null;
  }

  /**
   * Get all site names
   */
  async getSiteNames(): Promise<string[]> {
    const config = await this.loadConfiguration();
    return Object.keys(config.sites);
  }

  /**
   * Validate all configurations
   */
  async validateConfigurations(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const config = await this.loadConfiguration();

      // Validate app settings
      try {
        AppSettingsSchema.parse(config.app_settings);
      } catch (error) {
        errors.push(
          `App settings validation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Validate each site configuration
      for (const [siteName, siteConfig] of Object.entries(config.sites)) {
        try {
          SiteConfigSchema.parse(siteConfig);
        } catch (error) {
          errors.push(
            `Site ${siteName} validation failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      errors.push(
        `Configuration loading failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create default application settings
   */
  private createDefaultAppSettings(): AppSettings {
    return {
      global_settings: {
        headless: true,
        timeout: 30000,
        max_retries: 3,
        max_concurrent_requests: 3,
        delay_between_requests: 2000,
        max_requests_per_minute: 30,
        output_format: "json",
        output_directory: "./data",
        image_download: true,
        image_directory: "./data/images",
        log_level: "info",
      },
      browser_settings: {
        viewport: {
          width: 1920,
          height: 1080,
        },
        user_agent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        locale: "en-AU",
        timezone: "Australia/Sydney",
      },
    };
  }

  /**
   * Create default site configurations
   */
  private createDefaultSiteConfigurations(): Record<string, SiteConfig> {
    return {
      motoheaven: {
        name: "motoheaven",
        base_url: "https://www.motoheaven.com.au",
        adapter_type: "shopify",
        rate_limit: {
          requests_per_minute: 15,
          delay_between_requests: 2000,
          concurrent_requests: 2,
        },
        categories: ["helmets", "gloves", "jackets", "boots"],
        selectors: {
          product_container: ".product-item",
          product_name: ".product-item__product-title",
          price: ".product-item__price-main",
          stock_status: ".product-item__stock-status",
          brand: ".product-item__product-vendor",
          images: ".product-item__image img",
        },
        navigation: {
          product_list_pattern: "/collections/*",
          product_page_pattern: "/products/*",
        },
        anti_detection: {
          use_stealth: true,
          rotate_user_agents: false,
          simulate_human_behavior: true,
          block_images: false,
          block_css: false,
        },
      },
      mcas: {
        name: "mcas",
        base_url: "https://www.mcas.com.au",
        adapter_type: "mcas",
        rate_limit: {
          requests_per_minute: 20,
          delay_between_requests: 1500,
          concurrent_requests: 2,
        },
        categories: ["helmets", "protective-gear", "clothing"],
        selectors: {
          product_container: ".product-tile",
          product_name: ".product-name",
          price: ".price",
          stock_status: ".stock-status",
          brand: ".brand",
          images: ".product-image img",
        },
        navigation: {
          product_list_pattern: "/category/*",
          product_page_pattern: "/product/*",
        },
        anti_detection: {
          use_stealth: true,
          rotate_user_agents: true,
          simulate_human_behavior: true,
          block_images: true,
          block_css: false,
        },
      },
    };
  }

  /**
   * Ensure configuration directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
      console.log(`Created configuration directory: ${configDir}`);
    }
  }

  /**
   * Reload configuration from disk
   */
  async reloadConfiguration(): Promise<GlobalConfiguration> {
    this.config = null;
    return await this.loadConfiguration();
  }

  /**
   * Export configuration to a different directory
   */
  async exportConfiguration(exportPath: string): Promise<void> {
    const config = await this.loadConfiguration();

    await fs.mkdir(exportPath, { recursive: true });

    const appSettingsPath = path.join(exportPath, "settings.json");
    const sitesPath = path.join(exportPath, "sites.json");

    await fs.writeFile(
      appSettingsPath,
      JSON.stringify(config.app_settings, null, 2)
    );
    await fs.writeFile(
      sitesPath,
      JSON.stringify({ sites: config.sites }, null, 2)
    );

    console.log(`Configuration exported to: ${exportPath}`);
  }
}

export const configurationManager = new ConfigurationManager();
