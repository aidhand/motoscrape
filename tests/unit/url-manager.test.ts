import { describe, it, expect } from 'vitest';
import { URLManager } from '../../src/utils/url-manager.js';
import { SiteConfig } from '../../src/models/site-config.js';

describe('URLManager', () => {
  const siteConfigs: SiteConfig[] = [
    {
      name: 'motoheaven',
      base_url: 'https://www.motoheaven.com.au',
      adapter_type: 'shopify',
      rate_limit: { 
        requests_per_minute: 30, 
        delay_between_requests: 2000,
        concurrent_requests: 2 
      },
      categories: ['helmets', 'jackets'],
      selectors: {
        product_container: '.product-item',
        product_name: '.product-title',
        price: '.price',
        stock_status: '.stock-status',
        images: '.product-images img'
      },
      navigation: {
        product_list_pattern: '/collections/{category}',
        product_page_pattern: '/products/{product}'
      },
      anti_detection: {
        use_stealth: false,
        rotate_user_agents: false,
        simulate_human_behavior: false,
        block_images: false,
        block_css: false
      }
    },
    {
      name: 'mcas',
      base_url: 'https://mcas.com.au',
      adapter_type: 'mcas',
      rate_limit: { 
        requests_per_minute: 20, 
        delay_between_requests: 3000,
        concurrent_requests: 1 
      },
      categories: ['parts'],
      selectors: {
        product_container: '.item',
        product_name: '.item-title',
        price: '.item-price',
        stock_status: '.availability',
        images: '.item-images img'
      },
      navigation: {
        product_list_pattern: '/category/{category}',
        product_page_pattern: '/product/{product}'
      },
      anti_detection: {
        use_stealth: false,
        rotate_user_agents: false,
        simulate_human_behavior: false,
        block_images: false,
        block_css: false
      }
    }
  ];

  const urlManager = new URLManager(siteConfigs);

  describe('normalizeURL', () => {
    it('should normalize URLs by removing tracking parameters', () => {
      const dirtyUrl = 'https://www.motoheaven.com.au/products/helmet?utm_source=google&utm_medium=cpc&fbclid=123';
      const normalized = urlManager.normalizeURL(dirtyUrl, 'motoheaven');
      
      expect(normalized).toBe('https://www.motoheaven.com.au/products/helmet');
    });

    it('should handle relative URLs', () => {
      const relativeUrl = '/products/helmet';
      const normalized = urlManager.normalizeURL(relativeUrl, 'motoheaven');
      
      expect(normalized).toBe('https://www.motoheaven.com.au/products/helmet');
    });

    it('should throw error for unknown site', () => {
      expect(() => {
        urlManager.normalizeURL('https://example.com', 'unknown-site');
      }).toThrow('Unknown site: unknown-site');
    });
  });

  describe('generateCollectionURLs', () => {
    it('should generate paginated collection URLs', () => {
      const baseUrl = 'https://www.motoheaven.com.au/collections/helmets';
      const urls = urlManager.generateCollectionURLs(baseUrl, 3);
      
      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://www.motoheaven.com.au/collections/helmets?page=1');
      expect(urls[1]).toBe('https://www.motoheaven.com.au/collections/helmets?page=2');
      expect(urls[2]).toBe('https://www.motoheaven.com.au/collections/helmets?page=3');
    });
  });

  describe('generateShopifyCollectionURLs', () => {
    it('should generate Shopify collection URLs with base URL first', () => {
      const baseUrl = 'https://www.motoheaven.com.au/collections/helmets';
      const urls = urlManager.generateShopifyCollectionURLs(baseUrl, 3);
      
      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://www.motoheaven.com.au/collections/helmets');
      expect(urls[1]).toBe('https://www.motoheaven.com.au/collections/helmets?page=2');
      expect(urls[2]).toBe('https://www.motoheaven.com.au/collections/helmets?page=3');
    });
  });

  describe('generateCategoryURLs', () => {
    it('should generate category URLs from categories list', () => {
      const baseUrl = 'https://www.motoheaven.com.au';
      const categories = ['helmets', 'jackets', 'boots'];
      const urls = urlManager.generateCategoryURLs(baseUrl, categories);
      
      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://www.motoheaven.com.au/collections/helmets');
      expect(urls[1]).toBe('https://www.motoheaven.com.au/collections/jackets');
      expect(urls[2]).toBe('https://www.motoheaven.com.au/collections/boots');
    });

    it('should use custom pattern for category URLs', () => {
      const baseUrl = 'https://mcas.com.au';
      const categories = ['parts'];
      const pattern = '/category/{category}';
      const urls = urlManager.generateCategoryURLs(baseUrl, categories, pattern);
      
      expect(urls[0]).toBe('https://mcas.com.au/category/parts');
    });
  });

  describe('extractSiteFromURL', () => {
    it('should extract site name from hostname', () => {
      expect(urlManager.extractSiteFromURL('https://www.motoheaven.com.au/products/helmet')).toBe('motoheaven');
      expect(urlManager.extractSiteFromURL('https://mcas.com.au/parts/brake-pads')).toBe('mcas');
      expect(urlManager.extractSiteFromURL('https://unknown-site.com/products')).toBe('unknown');
    });
  });

  describe('isProductURL', () => {
    it('should identify product URLs', () => {
      expect(urlManager.isProductURL('https://example.com/products/helmet')).toBe(true);
      expect(urlManager.isProductURL('https://example.com/product/123')).toBe(true);
      expect(urlManager.isProductURL('https://example.com/collections/helmets')).toBe(false);
      expect(urlManager.isProductURL('https://example.com/about')).toBe(false);
    });
  });

  describe('isCollectionURL', () => {
    it('should identify collection URLs', () => {
      expect(urlManager.isCollectionURL('https://example.com/collections/helmets')).toBe(true);
      expect(urlManager.isCollectionURL('https://example.com/category/jackets')).toBe(true);
      expect(urlManager.isCollectionURL('https://example.com/products/helmet')).toBe(false);
      expect(urlManager.isCollectionURL('https://example.com/about')).toBe(false);
    });
  });

  describe('extractCategoryFromURL', () => {
    it('should extract category name from collection URLs', () => {
      expect(urlManager.extractCategoryFromURL('https://example.com/collections/helmets')).toBe('helmets');
      expect(urlManager.extractCategoryFromURL('https://example.com/category/jackets')).toBe('jackets');
      expect(urlManager.extractCategoryFromURL('https://example.com/shop/boots')).toBe('boots');
      expect(urlManager.extractCategoryFromURL('https://example.com/about')).toBe('unknown');
    });

    it('should handle URLs with query parameters', () => {
      expect(urlManager.extractCategoryFromURL('https://example.com/collections/helmets?page=2')).toBe('helmets');
    });
  });

  describe('buildSearchURL', () => {
    it('should build search URL with query and filters', () => {
      const baseUrl = 'https://example.com';
      const query = 'motorcycle helmet';
      const filters = { brand: 'shoei', price_min: '100' };
      
      const searchUrl = urlManager.buildSearchURL(baseUrl, query, filters);
      
      expect(searchUrl).toContain('https://example.com/search');
      expect(searchUrl).toContain('q=motorcycle+helmet');
      expect(searchUrl).toContain('brand=shoei');
      expect(searchUrl).toContain('price_min=100');
    });
  });

  describe('getCanonicalURL', () => {
    it('should normalize URL by removing fragments and sorting params', () => {
      const url = 'https://example.com/products/helmet?z=last&a=first#section';
      const canonical = urlManager.getCanonicalURL(url);
      
      expect(canonical).toBe('https://example.com/products/helmet?a=first&z=last');
    });
  });

  describe('isExternalURL', () => {
    it('should identify external URLs', () => {
      const baseUrl = 'https://motoheaven.com.au';
      
      expect(urlManager.isExternalURL('https://motoheaven.com.au/products/helmet', baseUrl)).toBe(false);
      expect(urlManager.isExternalURL('https://external-site.com/products/helmet', baseUrl)).toBe(true);
    });
  });

  describe('generateSitemapURL', () => {
    it('should generate common sitemap URLs', () => {
      const baseUrl = 'https://example.com';
      const sitemapUrls = urlManager.generateSitemapURL(baseUrl);
      
      expect(sitemapUrls).toContain('https://example.com/sitemap.xml');
      expect(sitemapUrls).toContain('https://example.com/sitemap_index.xml');
      expect(sitemapUrls).toContain('https://example.com/robots.txt');
    });
  });

  describe('isValidURL', () => {
    it('should validate URL format', () => {
      expect(urlManager.isValidURL('https://example.com')).toBe(true);
      expect(urlManager.isValidURL('http://example.com/path')).toBe(true);
      expect(urlManager.isValidURL('invalid-url')).toBe(false);
      expect(urlManager.isValidURL('')).toBe(false);
    });
  });

  describe('getURLComponents', () => {
    it('should parse URL into components', () => {
      const url = 'https://example.com:8080/path?query=value#fragment';
      const components = urlManager.getURLComponents(url);
      
      expect(components.protocol).toBe('https:');
      expect(components.host).toBe('example.com:8080');
      expect(components.pathname).toBe('/path');
      expect(components.search).toBe('?query=value');
      expect(components.hash).toBe('#fragment');
      expect(components.origin).toBe('https://example.com:8080');
    });
  });
});
