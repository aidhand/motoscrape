import { config } from './src/core/configuration-manager';
import { BrowserManager } from './src/core/browser-manager';
import { ShopifyAdapter } from './src/adapters/shopify-adapter';

async function testSingleProduct() {
  console.log('🧪 Testing single product extraction...');
  
  // Site config from main index
  const motoHeavenConfig = {
    name: "motoheaven",
    baseUrl: "https://www.motoheaven.com.au",
    type: "shopify" as const,
    collections: [],
    selectors: {
      product_container: ".product-grid-item",
      product_link: "a",
      product_name: "h1, .product-title, [data-product-title]",
      product_price: ".price, .product-price, [data-price]",
      product_brand: ".product-vendor, .brand, [data-vendor]",
      product_sku: ".product-sku, [data-sku]",
      product_images: "img[src*='cdn.shopify.com']",
      product_variants: "[data-variant-selector] input, .size-selector input, .variant-input",
      product_description: ".product-description, .rte, [data-product-description]"
    },
    rateLimit: {
      tokens: 15,
      refillRate: 0.25,
      minInterval: 5000
    }
  };

  const browserManager = new BrowserManager(config);
  const adapter = new ShopifyAdapter(motoHeavenConfig);
  
  try {
    await browserManager.initialize();
    const page = await browserManager.createPage();
    
    // Test AGV helmet
    const testUrl = 'https://www.motoheaven.com.au/collections/motorcycle-helmets/products/agv-pista-gp-rr-catalunya-2008-limited-edition-helmet';
    console.log(`Testing: ${testUrl}`);
    
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    
    const product = await adapter.extractProduct({ 
      page, 
      url: testUrl, 
      siteConfig: motoHeavenConfig,
      pageType: 'product'
    });
    
    if (product) {
      console.log('✅ Product extracted successfully:');
      console.log(`Name: ${product.name}`);
      console.log(`Brand: ${product.brand}`);
      console.log(`SKU: ${product.sku}`);
      console.log(`Images: ${product.images.length} images`);
      if (product.images.length > 0) {
        console.log(`First image: ${product.images[0]}`);
      }
      console.log(`Variants: ${product.variants?.length || 0} variants`);
      if (product.variants && product.variants.length > 0) {
        console.log(`Sample variant: ${product.variants[0].name} - ${product.variants[0].value}`);
      }
    } else {
      console.log('❌ Failed to extract product');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browserManager.close();
  }
}

testSingleProduct();
