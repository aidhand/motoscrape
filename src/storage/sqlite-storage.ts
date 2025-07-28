import Database from "better-sqlite3";
import path from "path";
import { promises as fs } from "fs";
import { Product } from "../models/product.js";
import { ProductVariant } from "../models/variant.js";

/**
 * SQLite database storage for product data
 */
export class SQLiteStorage {
  private db: Database.Database | null = null;
  private dbPath: string | null = null;

  constructor(private directory: string) {}

  /**
   * Save products to SQLite database
   */
  async save(products: Product[], filename: string): Promise<string> {
    await this.ensureDirectoryExists();

    const dbPath = path.join(this.directory, filename);
    this.dbPath = dbPath;

    // Initialize database
    this.db = new Database(dbPath);

    try {
      await this.initializeTables();
      await this.insertProducts(products);

      console.log(`Saved ${products.length} products to ${dbPath}`);
      return dbPath;
    } finally {
      this.close();
    }
  }

  /**
   * Load products from SQLite database
   */
  async load(filename: string): Promise<Product[]> {
    const dbPath = path.join(this.directory, filename);

    try {
      await fs.access(dbPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(`Database not found: ${dbPath}`);
        return [];
      }
      throw error;
    }

    this.db = new Database(dbPath, { readonly: true });

    try {
      const products = await this.selectProducts();
      console.log(`Loaded ${products.length} products from ${dbPath}`);
      return products;
    } finally {
      this.close();
    }
  }

  /**
   * Initialize database tables
   */
  private async initializeTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    // Products table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        sku TEXT,
        category TEXT NOT NULL,
        subcategory TEXT,
        regular_price REAL NOT NULL,
        sale_price REAL,
        currency TEXT NOT NULL DEFAULT 'AUD',
        discount_percentage INTEGER,
        in_stock BOOLEAN NOT NULL,
        stock_status TEXT NOT NULL,
        quantity INTEGER,
        short_description TEXT,
        full_description TEXT,
        certifications TEXT, -- JSON array
        compliance_adr BOOLEAN,
        compliance_standards TEXT, -- JSON array
        vehicle_types TEXT, -- JSON array
        makes TEXT, -- JSON array
        models TEXT, -- JSON array
        site TEXT NOT NULL,
        source_url TEXT NOT NULL,
        scraped_at TEXT NOT NULL,
        quality_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Images table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        image_order INTEGER DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Specifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_specifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        spec_key TEXT NOT NULL,
        spec_value TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Variants table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        regular_price REAL NOT NULL,
        sale_price REAL,
        currency TEXT NOT NULL DEFAULT 'AUD',
        discount_percentage INTEGER,
        in_stock BOOLEAN NOT NULL,
        stock_status TEXT NOT NULL,
        quantity INTEGER,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Variant images table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS variant_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        image_order INTEGER DEFAULT 0,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_site ON products(site);
      CREATE INDEX IF NOT EXISTS idx_products_scraped_at ON products(scraped_at);
      CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
    `);
  }

  /**
   * Insert products into database
   */
  private async insertProducts(products: Product[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(() => {
      const insertProduct = this.db!.prepare(`
        INSERT OR REPLACE INTO products (
          id, name, brand, sku, category, subcategory,
          regular_price, sale_price, currency, discount_percentage,
          in_stock, stock_status, quantity,
          short_description, full_description,
          certifications, compliance_adr, compliance_standards,
          vehicle_types, makes, models,
          site, source_url, scraped_at, quality_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertImage = this.db!.prepare(`
        INSERT INTO product_images (product_id, image_url, image_order) VALUES (?, ?, ?)
      `);

      const insertSpec = this.db!.prepare(`
        INSERT INTO product_specifications (product_id, spec_key, spec_value) VALUES (?, ?, ?)
      `);

      const insertVariant = this.db!.prepare(`
        INSERT OR REPLACE INTO product_variants (
          id, product_id, name, sku, type, value,
          regular_price, sale_price, currency, discount_percentage,
          in_stock, stock_status, quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertVariantImage = this.db!.prepare(`
        INSERT INTO variant_images (variant_id, image_url, image_order) VALUES (?, ?, ?)
      `);

      for (const product of products) {
        // Insert product
        insertProduct.run(
          product.id,
          product.name,
          product.brand,
          product.sku || null,
          product.category,
          product.subcategory || null,
          product.price.regular,
          product.price.sale || null,
          product.price.currency,
          product.price.discount_percentage || null,
          product.availability.in_stock,
          product.availability.stock_status,
          product.availability.quantity || null,
          product.description.short || null,
          product.description.full || null,
          JSON.stringify(product.certifications || []),
          product.compliance?.adr || null,
          JSON.stringify(product.compliance?.australian_standards || []),
          JSON.stringify(product.compatibility?.vehicle_types || []),
          JSON.stringify(product.compatibility?.makes || []),
          JSON.stringify(product.compatibility?.models || []),
          product.metadata.site,
          product.metadata.source_url,
          product.metadata.scraped_at.toISOString(),
          product.metadata.scrape_quality_score || null
        );

        // Insert images
        product.images.forEach((imageUrl, index) => {
          insertImage.run(product.id, imageUrl, index);
        });

        // Insert specifications
        if (product.description.specifications) {
          Object.entries(product.description.specifications).forEach(
            ([key, value]) => {
              insertSpec.run(product.id, key, value);
            }
          );
        }

        // Insert variants
        if (product.variants) {
          product.variants.forEach((variant) => {
            insertVariant.run(
              variant.id,
              product.id,
              variant.name,
              variant.sku || null,
              variant.type,
              variant.value,
              variant.price.regular,
              variant.price.sale || null,
              variant.price.currency,
              variant.price.discount_percentage || null,
              variant.availability.in_stock,
              variant.availability.stock_status,
              variant.availability.quantity || null
            );

            // Insert variant images
            if (variant.images) {
              variant.images.forEach((imageUrl, index) => {
                insertVariantImage.run(variant.id, imageUrl, index);
              });
            }
          });
        }
      }
    });

    transaction();
  }

  /**
   * Select products from database
   */
  private async selectProducts(): Promise<Product[]> {
    if (!this.db) throw new Error("Database not initialized");

    const products = this.db
      .prepare(
        `
      SELECT * FROM products ORDER BY scraped_at DESC
    `
      )
      .all() as any[];

    const productMap = new Map<string, Product>();

    for (const row of products) {
      const product: Product = {
        id: row.id,
        name: row.name,
        brand: row.brand,
        sku: row.sku,
        category: row.category,
        subcategory: row.subcategory,
        price: {
          regular: row.regular_price,
          sale: row.sale_price,
          currency: row.currency,
          discount_percentage: row.discount_percentage,
        },
        availability: {
          in_stock: Boolean(row.in_stock),
          stock_status: row.stock_status,
          quantity: row.quantity,
        },
        images: [],
        description: {
          short: row.short_description,
          full: row.full_description,
          specifications: {},
        },
        certifications: JSON.parse(row.certifications || "[]"),
        compliance: {
          adr: row.compliance_adr,
          australian_standards: JSON.parse(row.compliance_standards || "[]"),
        },
        compatibility: {
          vehicle_types: JSON.parse(row.vehicle_types || "[]"),
          makes: JSON.parse(row.makes || "[]"),
          models: JSON.parse(row.models || "[]"),
        },
        variants: [],
        metadata: {
          site: row.site,
          source_url: row.source_url,
          scraped_at: new Date(row.scraped_at),
          scrape_quality_score: row.quality_score,
        },
      };

      productMap.set(product.id, product);
    }

    // Load images
    const images = this.db
      .prepare(
        `
      SELECT product_id, image_url FROM product_images ORDER BY image_order
    `
      )
      .all() as any[];

    for (const row of images) {
      const product = productMap.get(row.product_id);
      if (product) {
        product.images.push(row.image_url);
      }
    }

    // Load specifications
    const specs = this.db
      .prepare(
        `
      SELECT product_id, spec_key, spec_value FROM product_specifications
    `
      )
      .all() as any[];

    for (const row of specs) {
      const product = productMap.get(row.product_id);
      if (product && product.description.specifications) {
        product.description.specifications[row.spec_key] = row.spec_value;
      }
    }

    // Load variants
    const variants = this.db
      .prepare(
        `
      SELECT * FROM product_variants
    `
      )
      .all() as any[];

    for (const row of variants) {
      const product = productMap.get(row.product_id);
      if (product) {
        const variant: ProductVariant = {
          id: row.id,
          name: row.name,
          sku: row.sku,
          type: row.type,
          value: row.value,
          price: {
            regular: row.regular_price,
            sale: row.sale_price,
            currency: row.currency,
            discount_percentage: row.discount_percentage,
          },
          availability: {
            in_stock: Boolean(row.in_stock),
            stock_status: row.stock_status,
            quantity: row.quantity,
          },
          images: [],
        };

        if (!product.variants) product.variants = [];
        product.variants.push(variant);
      }
    }

    // Load variant images
    const variantImages = this.db
      .prepare(
        `
      SELECT variant_id, image_url FROM variant_images ORDER BY image_order
    `
      )
      .all() as any[];

    for (const row of variantImages) {
      for (const product of productMap.values()) {
        const variant = product.variants?.find((v) => v.id === row.variant_id);
        if (variant) {
          if (!variant.images) variant.images = [];
          variant.images.push(row.image_url);
        }
      }
    }

    return Array.from(productMap.values());
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ files: number; totalSize: number }> {
    try {
      const files = await this.listFiles();
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.directory, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore errors for individual files
        }
      }

      return { files: files.length, totalSize };
    } catch {
      return { files: 0, totalSize: 0 };
    }
  }

  /**
   * List available database files
   */
  async listFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files.filter((file) => file.endsWith(".db"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clean up old database files
   */
  async cleanup(maxAgeHours: number): Promise<void> {
    const files = await this.listFiles();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const file of files) {
      try {
        const filePath = path.join(this.directory, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old database file: ${file}`);
        }
      } catch (error) {
        console.warn(`Error cleaning up file ${file}:`, error);
      }
    }
  }

  /**
   * Close database connection
   */
  private close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.directory);
    } catch {
      await fs.mkdir(this.directory, { recursive: true });
      console.log(`Created storage directory: ${this.directory}`);
    }
  }
}
