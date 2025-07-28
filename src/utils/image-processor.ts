import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

export interface ImageDownloadOptions {
  maxSize: number; // in bytes
  allowedTypes: string[];
  directory: string;
  quality?: number;
  resize?: {
    width: number;
    height: number;
  };
}

export interface ImageResult {
  originalUrl: string;
  localPath: string;
  filename: string;
  size: number;
  mimeType: string;
  hash: string;
  downloadedAt: Date;
}

/**
 * Image processing and storage manager
 */
export class ImageProcessor {
  private readonly defaultOptions: ImageDownloadOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ],
    directory: "./data/images",
    quality: 85,
  };

  constructor(private options: Partial<ImageDownloadOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Download and process images from URLs
   */
  async processImages(
    urls: string[],
    productId: string
  ): Promise<ImageResult[]> {
    if (!urls || urls.length === 0) return [];

    const results: ImageResult[] = [];
    await this.ensureDirectoryExists();

    for (const url of urls) {
      try {
        const result = await this.downloadImage(url, productId);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.warn(
          `Failed to download image ${url}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return results;
  }

  /**
   * Download a single image
   */
  private async downloadImage(
    url: string,
    productId: string
  ): Promise<ImageResult | null> {
    try {
      // Validate URL
      if (!this.isValidImageUrl(url)) {
        console.warn(`Invalid image URL: ${url}`);
        return null;
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "en-AU,en-US;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        console.warn(
          `Failed to fetch image ${url}: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!this.options.allowedTypes?.includes(contentType)) {
        console.warn(`Unsupported image type ${contentType} for URL: ${url}`);
        return null;
      }

      const contentLength = parseInt(
        response.headers.get("content-length") || "0"
      );
      if (
        contentLength > (this.options.maxSize || this.defaultOptions.maxSize)
      ) {
        console.warn(
          `Image too large (${contentLength} bytes) for URL: ${url}`
        );
        return null;
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Generate filename
      const hash = createHash("md5").update(uint8Array).digest("hex");
      const extension = this.getExtensionFromMimeType(contentType);
      const filename = `${productId}_${hash}${extension}`;
      const localPath = path.join(
        this.options.directory || this.defaultOptions.directory,
        filename
      );

      // Check if file already exists
      try {
        await fs.access(localPath);
        console.log(`Image already exists: ${filename}`);

        const stats = await fs.stat(localPath);
        return {
          originalUrl: url,
          localPath,
          filename,
          size: stats.size,
          mimeType: contentType,
          hash,
          downloadedAt: stats.mtime,
        };
      } catch {
        // File doesn't exist, continue with download
      }

      // Save image
      await fs.writeFile(localPath, uint8Array);

      const stats = await fs.stat(localPath);

      console.log(`Downloaded image: ${filename} (${stats.size} bytes)`);

      return {
        originalUrl: url,
        localPath,
        filename,
        size: stats.size,
        mimeType: contentType,
        hash,
        downloadedAt: new Date(),
      };
    } catch (error) {
      console.error(
        `Error downloading image ${url}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Validate if URL looks like an image
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      // Check for image extensions
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".svg",
        ".gif",
      ];
      const hasImageExtension = imageExtensions.some((ext) =>
        pathname.endsWith(ext)
      );

      // Check if URL contains image-like patterns
      const hasImagePattern =
        pathname.includes("image") ||
        pathname.includes("photo") ||
        pathname.includes("picture") ||
        pathname.includes("img");

      return hasImageExtension || hasImagePattern;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/gif": ".gif",
    };

    return extensions[mimeType] || ".jpg";
  }

  /**
   * Ensure the images directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    const directory = this.options.directory || this.defaultOptions.directory;
    try {
      await fs.access(directory);
    } catch {
      await fs.mkdir(directory, { recursive: true });
      console.log(`Created images directory: ${directory}`);
    }
  }

  /**
   * Clean up old images based on age
   */
  async cleanupOldImages(maxAgeHours: number = 24 * 7): Promise<void> {
    const directory = this.options.directory || this.defaultOptions.directory;
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

    try {
      const files = await fs.readdir(directory);
      const now = Date.now();

      for (const file of files) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            console.log(`Cleaned up old image: ${file}`);
          }
        } catch (error) {
          console.warn(
            `Error checking file ${file}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } catch (error) {
      console.error(
        "Error during image cleanup:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    directory: string;
  }> {
    const directory = this.options.directory || this.defaultOptions.directory;

    try {
      const files = await fs.readdir(directory);
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore errors for individual files
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        directory,
      };
    } catch {
      return {
        totalFiles: 0,
        totalSize: 0,
        directory,
      };
    }
  }
}

export const imageProcessor = new ImageProcessor();
