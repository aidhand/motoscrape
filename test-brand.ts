import { BrowserManager } from './src/core/browser-manager';
import { ShopifyAdapter } from './src/adapters/shopify-adapter';
import { motoHeavenConfig } from './src/index';

async function testBrandExtraction() {
  console.log('🧪 Testing brand extraction for MotoHeaven product...');
  
  const browserManager = new BrowserManager();
  const adapter = new ShopifyAdapter(motoHeavenConfig);
  
  try {
    await browserManager.initialize();
    const page = await browserManager.getPage();
    
    // Test Shoei helmet
    const testUrl = 'https://www.motoheaven.com.au/collections/motorcycle-helmets/products/shoei-x-spr-pro-proxy-tc-10-helmet';
    console.log(`Testing: ${testUrl}`);
    
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    
    const product = await adapter.extractProduct({ page, url: testUrl, siteConfig: motoHeavenConfig });
    
    if (product) {
      console.log('✅ Product extracted successfully:');
      console.log(`Name: ${product.name}`);
      console.log(`Brand: ${product.brand}`);
      console.log(`SKU: ${product.sku}`);
      console.log(`Images: ${product.images.length} images`);
      console.log(`Variants: ${product.variants.length} variants`);
      if (product.variants.length > 0) {
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

testBrandExtraction();
