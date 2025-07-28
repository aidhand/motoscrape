#!/usr/bin/env node

/**
 * MotoScrape CLI - Command line interface for configuration management
 */

import { ConfigLoader, ConfigValidator } from './config/config-loader.js';
import { createLogger } from './utils/logging.js';

const logger = createLogger('CLI');

interface CLICommand {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: CLICommand[] = [
  {
    name: 'config:init',
    description: 'Initialize configuration templates',
    handler: handleConfigInit,
  },
  {
    name: 'config:validate',
    description: 'Validate configuration files',
    handler: handleConfigValidate,
  },
  {
    name: 'config:list',
    description: 'List available site configurations',
    handler: handleConfigList,
  },
  {
    name: 'help',
    description: 'Show this help message',
    handler: handleHelp,
  },
];

async function handleConfigInit(args: string[]): Promise<void> {
  const outputDir = args[0] || './config';
  
  logger.info(`Initializing configuration templates in ${outputDir}`);
  ConfigLoader.createConfigTemplate(outputDir);
  
  console.log('✅ Configuration templates created successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Edit the configuration files to match your needs');
  console.log('2. Set environment variables to point to your config files:');
  console.log('   export MOTOSCRAPE_APP_CONFIG=/path/to/app-settings.json');
  console.log('   export MOTOSCRAPE_SITE_CONFIGS=/path/to/site-configs.json');
  console.log('3. Run motoscrape to start scraping');
}

async function handleConfigValidate(args: string[]): Promise<void> {
  const appConfigPath = args[0] || process.env.MOTOSCRAPE_APP_CONFIG;
  const siteConfigsPath = args[1] || process.env.MOTOSCRAPE_SITE_CONFIGS;
  
  let hasErrors = false;
  
  if (appConfigPath) {
    logger.info(`Validating app settings: ${appConfigPath}`);
    try {
      const appSettings = ConfigLoader.loadAppSettings(appConfigPath);
      const validation = ConfigValidator.validateAppSettings(appSettings);
      
      if (validation.valid) {
        console.log('✅ App settings are valid');
      } else {
        console.log('❌ App settings validation failed:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
        hasErrors = true;
      }
    } catch (error) {
      console.log(`❌ Failed to load app settings: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }
  }
  
  if (siteConfigsPath) {
    logger.info(`Validating site configs: ${siteConfigsPath}`);
    try {
      const siteConfigs = ConfigLoader.loadSiteConfigs(siteConfigsPath);
      const validation = ConfigValidator.validateSiteConfigs(siteConfigs);
      
      if (validation.valid) {
        console.log(`✅ All ${siteConfigs.length} site configurations are valid`);
      } else {
        console.log('❌ Site configurations validation failed:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
        hasErrors = true;
      }
    } catch (error) {
      console.log(`❌ Failed to load site configs: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }
  }
  
  if (!appConfigPath && !siteConfigsPath) {
    console.log('⚠️  No configuration files specified');
    console.log('Use: motoscrape config:validate <app-config-path> <site-configs-path>');
    console.log('Or set environment variables MOTOSCRAPE_APP_CONFIG and MOTOSCRAPE_SITE_CONFIGS');
  }
  
  if (hasErrors) {
    process.exit(1);
  }
}

async function handleConfigList(): Promise<void> {
  const { siteConfigs } = ConfigLoader.loadFromEnvironment();
  
  console.log(`Available site configurations (${siteConfigs.length}):`);
  console.log('');
  
  siteConfigs.forEach(config => {
    console.log(`📍 ${config.name}`);
    console.log(`   Type: ${config.adapter_type}`);
    console.log(`   URL: ${config.base_url}`);
    console.log(`   Categories: ${config.categories?.join(', ') || 'none'}`);
    console.log(`   Rate limit: ${config.rate_limit?.requests_per_minute || 'default'} req/min`);
    console.log('');
  });
}

async function handleHelp(): Promise<void> {
  console.log('MotoScrape CLI - Configuration Management Tool');
  console.log('');
  console.log('Usage: motoscrape <command> [options]');
  console.log('');
  console.log('Commands:');
  
  commands.forEach(cmd => {
    console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
  });
  
  console.log('');
  console.log('Environment Variables:');
  console.log('  MOTOSCRAPE_APP_CONFIG     Path to app settings JSON file');
  console.log('  MOTOSCRAPE_SITE_CONFIGS   Path to site configurations JSON file');
  console.log('');
  console.log('Examples:');
  console.log('  motoscrape config:init ./my-config');
  console.log('  motoscrape config:validate ./config/app-settings.json ./config/site-configs.json');
  console.log('  motoscrape config:list');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const commandName = args[0];
  
  if (!commandName) {
    await handleHelp();
    return;
  }
  
  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.log(`❌ Unknown command: ${commandName}`);
    console.log('');
    await handleHelp();
    process.exit(1);
  }
  
  try {
    await command.handler(args.slice(1));
  } catch (error) {
    logger.error(`Command failed: ${commandName}`, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });
}