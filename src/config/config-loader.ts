import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AppSettings, SiteConfig, AppSettingsSchema, SiteConfigSchema } from "../models/site-config.js";
import { createAppSettings, defaultAppSettings } from './app-settings.js';
import { getAllSiteConfigs, getSiteConfig } from './site-configs.js';

/**
 * Configuration loader for external config files
 */
export class ConfigLoader {
  /**
   * Load application settings from file or use defaults
   */
  static loadAppSettings(configPath?: string): AppSettings {
    if (configPath && existsSync(configPath)) {
      try {
        const configData = JSON.parse(readFileSync(configPath, 'utf8'));
        return createAppSettings(configData);
      } catch (error) {
        console.warn(`Failed to load app settings from ${configPath}:`, error);
        console.warn('Using default settings instead');
      }
    }
    
    return defaultAppSettings;
  }

  /**
   * Load site configurations from file or use defaults
   */
  static loadSiteConfigs(configPath?: string): SiteConfig[] {
    if (configPath && existsSync(configPath)) {
      try {
        const configData = JSON.parse(readFileSync(configPath, 'utf8'));
        
        if (Array.isArray(configData)) {
          // Array of site configs
          return configData.map(config => SiteConfigSchema.parse(config));
        } else if (configData.sites && Array.isArray(configData.sites)) {
          // Wrapped in sites property
          return configData.sites.map((config: any) => SiteConfigSchema.parse(config));
        } else {
          // Single site config
          return [SiteConfigSchema.parse(configData)];
        }
      } catch (error) {
        console.warn(`Failed to load site configs from ${configPath}:`, error);
        console.warn('Using default site configurations instead');
      }
    }
    
    return getAllSiteConfigs();
  }

  /**
   * Load specific site configuration by name
   */
  static loadSiteConfig(siteName: string, configPath?: string): SiteConfig | undefined {
    if (configPath && existsSync(configPath)) {
      const configs = this.loadSiteConfigs(configPath);
      return configs.find(config => config.name === siteName);
    }
    
    return getSiteConfig(siteName);
  }

  /**
   * Load configuration from environment variables
   */
  static loadFromEnvironment(): { appSettings: AppSettings; siteConfigs: SiteConfig[] } {
    const appSettingsPath = process.env.MOTOSCRAPE_APP_CONFIG;
    const siteConfigsPath = process.env.MOTOSCRAPE_SITE_CONFIGS;
    
    const appSettings = this.loadAppSettings(appSettingsPath);
    const siteConfigs = this.loadSiteConfigs(siteConfigsPath);
    
    return { appSettings, siteConfigs };
  }

  /**
   * Create configuration directory structure
   */
  static createConfigTemplate(outputDir: string = './config'): void {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Create config directory
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Write app settings template
      const appSettingsPath = path.join(outputDir, 'app-settings.json');
      fs.writeFileSync(appSettingsPath, JSON.stringify(defaultAppSettings, null, 2));
      
      // Write site configs template
      const siteConfigsPath = path.join(outputDir, 'site-configs.json');
      fs.writeFileSync(siteConfigsPath, JSON.stringify({ sites: getAllSiteConfigs() }, null, 2));
      
      console.log(`Configuration templates created in ${outputDir}`);
      console.log(`- App settings: ${appSettingsPath}`);
      console.log(`- Site configs: ${siteConfigsPath}`);
      
    } catch (error) {
      console.error('Failed to create config templates:', error);
    }
  }
}

/**
 * Validate configuration objects
 */
export class ConfigValidator {
  /**
   * Validate app settings
   */
  static validateAppSettings(settings: unknown): { valid: boolean; errors: string[] } {
    try {
      AppSettingsSchema.parse(settings);
      return { valid: true, errors: [] };
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [error.message];
      return { valid: false, errors };
    }
  }

  /**
   * Validate site configuration
   */
  static validateSiteConfig(config: unknown): { valid: boolean; errors: string[] } {
    try {
      SiteConfigSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [error.message];
      return { valid: false, errors };
    }
  }

  /**
   * Validate array of site configurations
   */
  static validateSiteConfigs(configs: unknown[]): { valid: boolean; errors: string[] } {
    const allErrors: string[] = [];
    let allValid = true;

    if (!Array.isArray(configs)) {
      return { valid: false, errors: ['Site configs must be an array'] };
    }

    configs.forEach((config, index) => {
      const result = this.validateSiteConfig(config);
      if (!result.valid) {
        allValid = false;
        allErrors.push(...result.errors.map(error => `Config ${index}: ${error}`));
      }
    });

    return { valid: allValid, errors: allErrors };
  }
}