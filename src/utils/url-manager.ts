import { 
  parseURL, 
  stringifyParsedURL, 
  cleanDoubleSlashes, 
  withQuery, 
  hasProtocol,
  joinURL
} from 'ufo';
import { SiteConfig } from '../models/site-config.js';

/**
 * URL management utility using UFO for consistent URL handling
 */
export class URLManager {
  private baseUrls: Map<string, string> = new Map();

  constructor(siteConfigs: SiteConfig[]) {
    siteConfigs.forEach(config => {
      this.baseUrls.set(config.name, config.base_url);
    });
  }

  /**
   * Normalize URLs from different sites for consistent processing
   */
  normalizeURL(url: string, siteName: string): string {
    const baseUrl = this.baseUrls.get(siteName);
    if (!baseUrl) {
      throw new Error(`Unknown site: ${siteName}`);
    }

    // Handle relative URLs
    if (!hasProtocol(url)) {
      return joinURL(baseUrl, url);
    }

    // Parse the URL for processing
    const _parsed = parseURL(url);
    
    // Remove tracking parameters manually
    const cleanUrl = this.removeTrackingParams(url);

    return cleanDoubleSlashes(cleanUrl);
  }

  /**
   * Remove tracking parameters from URL
   */
  private removeTrackingParams(url: string): string {
    const parsed = parseURL(url);
    if (!parsed.search) {
      return url;
    }

    const params = new URLSearchParams(parsed.search);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign',
      'fbclid', 'gclid', '_ga', '_gac', '_gad',
      'mc_cid', 'mc_eid', // Mailchimp
      'ref', 'source', 'campaign', // Generic tracking
      'msclkid', 'gclsrc' // Microsoft/Google tracking
    ];

    trackingParams.forEach(param => params.delete(param));

    parsed.search = params.toString();
    return stringifyParsedURL(parsed);
  }

  /**
   * Generate collection URLs with proper pagination
   */
  generateCollectionURLs(baseCollectionUrl: string, maxPages: number): string[] {
    const urls: string[] = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const paginatedUrl = withQuery(baseCollectionUrl, { page });
      urls.push(paginatedUrl);
    }

    return urls;
  }

  /**
   * Generate Shopify-specific collection URLs
   */
  generateShopifyCollectionURLs(baseCollectionUrl: string, maxPages: number): string[] {
    const urls: string[] = [baseCollectionUrl]; // Include base URL
    
    for (let page = 2; page <= maxPages; page++) {
      const paginatedUrl = withQuery(baseCollectionUrl, { page });
      urls.push(paginatedUrl);
    }

    return urls;
  }

  /**
   * Generate category URLs for a site
   */
  generateCategoryURLs(baseUrl: string, categories: string[], pattern: string = '/collections/{category}'): string[] {
    const urls: string[] = [];
    
    for (const category of categories) {
      const categoryPath = pattern.replace('{category}', category);
      const categoryUrl = joinURL(baseUrl, categoryPath);
      urls.push(categoryUrl);
    }

    return urls;
  }

  /**
   * Extract site identifier from URL
   */
  extractSiteFromURL(url: string): string {
    const parsed = parseURL(url);
    const hostname = parsed.host;
    
    if (!hostname) {
      return 'unknown';
    }

    // Map hostnames to site names
    const hostMapping: Record<string, string> = {
      'motoheaven.com.au': 'motoheaven',
      'www.motoheaven.com.au': 'motoheaven',
      'mcas.com.au': 'mcas',
      'www.mcas.com.au': 'mcas',
      'bikebiz.com.au': 'bikebiz',
      'www.bikebiz.com.au': 'bikebiz',
      'amx.com.au': 'amx',
      'www.amx.com.au': 'amx'
    };

    return hostMapping[hostname] || 'unknown';
  }

  /**
   * Check if URL is a product page
   */
  isProductURL(url: string, _siteName?: string): boolean {
    const parsed = parseURL(url);
    const pathname = parsed.pathname || '';

    // Common product URL patterns
    const productPatterns = [
      '/products/',
      '/product/',
      '/item/',
      '/p/',
      '/gear/'
    ];

    return productPatterns.some(pattern => pathname.includes(pattern));
  }

  /**
   * Check if URL is a collection/category page
   */
  isCollectionURL(url: string, _siteName?: string): boolean {
    const parsed = parseURL(url);
    const pathname = parsed.pathname || '';

    // Common collection URL patterns
    const collectionPatterns = [
      '/collections/',
      '/collection/',
      '/category/',
      '/categories/',
      '/shop/',
      '/browse/'
    ];

    return collectionPatterns.some(pattern => pathname.includes(pattern));
  }

  /**
   * Extract category/collection name from URL
   */
  extractCategoryFromURL(url: string): string {
    const parsed = parseURL(url);
    const pathname = parsed.pathname || '';

    // Try to extract category from common patterns
    const patterns = [
      /\/collections\/([^/?]+)/,
      /\/category\/([^/?]+)/,
      /\/shop\/([^/?]+)/,
      /\/browse\/([^/?]+)/
    ];

    for (const pattern of patterns) {
      const match = pathname.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }

  /**
   * Build search URL with query parameters
   */
  buildSearchURL(baseUrl: string, query: string, filters?: Record<string, string>): string {
    const searchParams: Record<string, string> = {
      q: query,
      ...filters
    };

    return withQuery(joinURL(baseUrl, '/search'), searchParams);
  }

  /**
   * Resolve relative URL against base URL
   */
  resolveURL(baseUrl: string, relativeUrl: string): string {
    if (hasProtocol(relativeUrl)) {
      return relativeUrl;
    }

    return joinURL(baseUrl, relativeUrl);
  }

  /**
   * Get canonical URL (remove fragments, normalize params)
   */
  getCanonicalURL(url: string): string {
    const parsed = parseURL(url);
    
    // Remove fragment
    parsed.hash = '';
    
    // Sort query parameters for consistency
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      const sortedParams = new URLSearchParams();
      
      Array.from(params.keys())
        .sort()
        .forEach(key => {
          sortedParams.set(key, params.get(key) || '');
        });
      
      parsed.search = sortedParams.toString();
    }

    return stringifyParsedURL(parsed);
  }

  /**
   * Check if URL is external (different domain)
   */
  isExternalURL(url: string, baseUrl: string): boolean {
    const urlParsed = parseURL(url);
    const baseParsed = parseURL(baseUrl);
    
    return urlParsed.host !== baseParsed.host;
  }

  /**
   * Get domain from URL
   */
  getDomain(url: string): string {
    const parsed = parseURL(url);
    return parsed.host || '';
  }

  /**
   * Add UTM parameters for tracking
   */
  addTrackingParams(url: string, params: Record<string, string>): string {
    return withQuery(url, params);
  }

  /**
   * Remove all query parameters from URL
   */
  removeAllParams(url: string): string {
    const parsed = parseURL(url);
    parsed.search = '';
    return stringifyParsedURL(parsed);
  }

  /**
   * Get URL without query parameters and fragments
   */
  getCleanURL(url: string): string {
    const parsed = parseURL(url);
    parsed.search = '';
    parsed.hash = '';
    return stringifyParsedURL(parsed);
  }

  /**
   * Generate sitemap URL for a domain
   */
  generateSitemapURL(baseUrl: string): string[] {
    const sitemapUrls = [
      joinURL(baseUrl, '/sitemap.xml'),
      joinURL(baseUrl, '/sitemap_index.xml'),
      joinURL(baseUrl, '/sitemaps.xml'),
      joinURL(baseUrl, '/robots.txt') // Not sitemap but useful for discovery
    ];

    return sitemapUrls;
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      const parsed = parseURL(url);
      return !!(parsed.protocol && parsed.host);
    } catch {
      return false;
    }
  }

  /**
   * Get URL components
   */
  getURLComponents(url: string) {
    const parsed = parseURL(url);
    
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: `${parsed.protocol}//${parsed.host}`
    };
  }

  /**
   * Update site configuration
   */
  updateSiteConfig(siteName: string, baseUrl: string): void {
    this.baseUrls.set(siteName, baseUrl);
  }

  /**
   * Get all configured sites
   */
  getConfiguredSites(): string[] {
    return Array.from(this.baseUrls.keys());
  }

  /**
   * Get base URL for site
   */
  getBaseURL(siteName: string): string | undefined {
    return this.baseUrls.get(siteName);
  }
}
