import { describe, it, expect } from 'vitest';
import { DataNormalizer } from '../../src/utils/data-normalizer.js';

describe('DataNormalizer', () => {
  describe('normalizeProduct', () => {
    it('should normalize basic product data', () => {
      const rawData = {
        name: 'Test Motorcycle Helmet',
        brand: 'TestBrand',
        price: '$299.99',
        description: 'A great helmet for testing',
        category: 'helmets',
        images: ['http://example.com/image1.jpg'],
        source_url: 'http://example.com/products/test-helmet'
      };

      const normalized = DataNormalizer.normalizeProduct(rawData, 'test-site');

      expect(normalized.id).toBe('test-site-test-motorcycle-helmet');
      expect(normalized.name).toBe('Test Motorcycle Helmet');
      expect(normalized.brand).toBe('TestBrand');
      expect(normalized.price.regular).toBe(299.99);
      expect(normalized.price.currency).toBe('AUD');
      expect(normalized.category).toBe('helmets');
      expect(normalized.images).toEqual(['http://example.com/image1.jpg']);
      expect(normalized.metadata.site).toBe('test-site');
      expect(normalized.metadata.source_url).toBe('http://example.com/products/test-helmet');
    });

    it('should handle missing fields with defaults', () => {
      const rawData = {
        title: 'Unnamed Product'
      };

      const normalized = DataNormalizer.normalizeProduct(rawData, 'test-site');

      expect(normalized.name).toBe('Unnamed Product');
      expect(normalized.brand).toBe('Unknown');
      expect(normalized.price.regular).toBe(0);
      expect(normalized.category).toBe('uncategorized');
      expect(normalized.images).toEqual([]);
      expect(normalized.variants).toEqual([]);
    });

    it('should extract numeric prices from various formats', () => {
      const testCases = [
        { input: '$299.99', expected: 299.99 },
        { input: 'AUD $150.00', expected: 150 },
        { input: '1,299.99', expected: 1299.99 },
        { input: '89', expected: 89 },
        { input: 89, expected: 89 },
        { input: 'Free', expected: 0 },
        { input: '', expected: 0 }
      ];

      testCases.forEach(({ input, expected }) => {
        const rawData = { price: input };
        const normalized = DataNormalizer.normalizeProduct(rawData, 'test');
        expect(normalized.price.regular).toBe(expected);
      });
    });

    it('should normalize product variants', () => {
      const rawData = {
        name: 'Test Product',
        variants: [
          {
            id: 'var1',
            title: 'Small Red',
            price: 100,
            available: true,
            size: 'Small',
            color: 'Red'
          },
          {
            id: 'var2',
            title: 'Large Blue',
            price: 120,
            available: false,
            size: 'Large',
            color: 'Blue'
          }
        ]
      };

      const normalized = DataNormalizer.normalizeProduct(rawData, 'test');

      expect(normalized.variants).toHaveLength(2);
      expect(normalized.variants?.[0].id).toBe('var1');
      expect(normalized.variants?.[0].name).toBe('Small Red');
      expect(normalized.variants?.[0].type).toBe('color');
      expect(normalized.variants?.[0].value).toBe('Red');
      expect(normalized.variants?.[0].price.regular).toBe(100);
      expect(normalized.variants?.[0].availability.in_stock).toBe(true);
      
      expect(normalized.variants?.[1].availability.in_stock).toBe(false);
    });

    it('should calculate quality score correctly', () => {
      const highQualityData = {
        name: 'Complete Product',
        brand: 'TestBrand',
        price: 299.99,
        description: 'Full description',
        images: ['img1.jpg', 'img2.jpg'],
        category: 'helmets',
        sku: 'SKU123'
      };

      const lowQualityData = {
        title: 'Basic Product'
      };

      const highQualityProduct = DataNormalizer.normalizeProduct(highQualityData, 'test');
      const lowQualityProduct = DataNormalizer.normalizeProduct(lowQualityData, 'test');

      expect(highQualityProduct.metadata.scrape_quality_score).toBe(1);
      expect(lowQualityProduct.metadata.scrape_quality_score).toBeLessThan(0.5);
    });
  });

  describe('mergeExtractionResults', () => {
    it('should merge multiple partial products', () => {
      const result1 = { name: 'Product Name', brand: 'Brand1' };
      const result2 = { price: { regular: 100, currency: 'AUD' as const }, category: 'test' };
      const result3 = { description: { full: 'Full description' } };

      const merged = DataNormalizer.mergeExtractionResults([result1, result2, result3]);

      expect(merged.name).toBe('Product Name');
      expect(merged.brand).toBe('Brand1');
      expect(merged.price?.regular).toBe(100);
      expect(merged.category).toBe('test');
      expect(merged.description?.full).toBe('Full description');
    });

    it('should prioritize first non-empty values', () => {
      const result1 = { name: 'First Name', brand: 'First Brand' };
      const result2 = { name: 'Second Name', price: { regular: 100, currency: 'AUD' as const } };

      const merged = DataNormalizer.mergeExtractionResults([result1, result2]);

      expect(merged.name).toBe('First Name');
      expect(merged.brand).toBe('First Brand');
      expect(merged.price?.regular).toBe(100);
    });
  });

  describe('cleanProductData', () => {
    it('should remove duplicate products based on content hash', () => {
      const product1 = DataNormalizer.normalizeProduct({
        name: 'Test Product',
        brand: 'Brand A',
        price: 100
      }, 'site1');

      const product2 = DataNormalizer.normalizeProduct({
        name: 'Test Product',
        brand: 'Brand A', 
        price: 100
      }, 'site1');

      const product3 = DataNormalizer.normalizeProduct({
        name: 'Different Product',
        brand: 'Brand B',
        price: 200
      }, 'site1');

      const products = [product1, product2, product3];
      const cleaned = DataNormalizer.cleanProductData(products);

      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].name).toBe('Test Product');
      expect(cleaned[1].name).toBe('Different Product');
    });
  });

  describe('validateProduct', () => {
    it('should validate correct product structure', () => {
      const validProduct = DataNormalizer.normalizeProduct({
        name: 'Valid Product',
        brand: 'Valid Brand',
        price: 100,
        source_url: 'http://example.com'
      }, 'test');

      const validation = DataNormalizer.validateProduct(validProduct);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
