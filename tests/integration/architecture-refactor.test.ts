import { describe, it, expect, beforeEach } from "vitest";
import { ValidationService } from "../../src/domain/services/validation-service.js";
import { QueueService } from "../../src/domain/services/queue-service.js";
import { RateLimitingService } from "../../src/infrastructure/rate-limiting/rate-limiting-service.js";

describe("Refactored Architecture Tests", () => {
  describe("ValidationService", () => {
    let validationService: ValidationService;

    beforeEach(() => {
      validationService = new ValidationService();
    });

    it("should validate a product successfully", () => {
      const product = {
        id: "test-1",
        name: "Test Product",
        brand: "Test Brand",
        category: "test",
        price: 99.99,
        availability: "in_stock",
        url: "https://test.com/product",
        images: ["https://test.com/image.jpg"],
        metadata: {
          siteName: "test",
          scrapedAt: new Date().toISOString(),
        },
      };

      const result = validationService.validateProduct(product);
      if (!result.success) {
        console.log("Validation errors:", result.errors);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    it("should return validation statistics", () => {
      const stats = validationService.getStats();
      expect(stats).toHaveProperty("totalValidated");
      expect(stats).toHaveProperty("validProducts");
      expect(stats).toHaveProperty("invalidProducts");
      expect(stats).toHaveProperty("errors");
    });
  });

  describe("QueueService", () => {
    let queueService: QueueService;

    beforeEach(() => {
      queueService = new QueueService();
    });

    it("should add URLs to queue", () => {
      const id = queueService.addUrl("https://test.com", "test-site");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should get queue status", () => {
      queueService.addUrl("https://test.com", "test-site");
      const status = queueService.getStatus();
      
      expect(status).toHaveProperty("pending");
      expect(status).toHaveProperty("processing");
      expect(status).toHaveProperty("completed");
      expect(status).toHaveProperty("failed");
      expect(status).toHaveProperty("total");
      expect(status.pending).toBe(1);
    });

    it("should process queue items", () => {
      queueService.addUrl("https://test.com", "test-site");
      const item = queueService.getNext();
      
      expect(item).toBeDefined();
      expect(item?.url).toBe("https://test.com");
      expect(item?.siteName).toBe("test-site");
    });
  });

  describe("RateLimitingService", () => {
    let rateLimitingService: RateLimitingService;

    beforeEach(() => {
      rateLimitingService = new RateLimitingService();
    });

    it("should configure site rate limits", () => {
      rateLimitingService.configureSite("test-site", 10, 5, 1000);
      const status = rateLimitingService.getStatus();
      
      expect(status["test-site"]).toBeDefined();
      expect(status["test-site"].requestsPerMinute).toBe(10);
    });

    it("should track requests", () => {
      rateLimitingService.configureSite("test-site", 10, 5, 1000);
      
      expect(rateLimitingService.isAllowed("test-site")).toBe(true);
      
      rateLimitingService.recordRequest("test-site");
      const status = rateLimitingService.getStatus();
      
      expect(status["test-site"].currentRequests).toBe(1);
    });
  });
});