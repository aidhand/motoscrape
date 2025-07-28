# MotoScrape Architecture Documentation

## Overview

MotoScrape has been refactored to adopt a **Component/Service Oriented** and **Layered Architecture** pattern, providing better separation of concerns, improved testability, and enhanced maintainability.

## Architecture Layers

### 1. **Application Layer** (`src/application/`)
The Application Layer orchestrates business operations and manages the overall application lifecycle.

- **`ScrapingApplication`**: Main application orchestrator that coordinates all services
- **`ServiceContainer`**: Dependency injection container for service management
- **Configuration**: Service wiring and dependency resolution

### 2. **Domain/Business Layer** (`src/domain/`)
The Domain Layer contains pure business logic with no external dependencies.

#### Services (`src/domain/services/`)
- **`ScrapingService`**: Core scraping business logic and adapter coordination
- **`QueueService`**: URL queue management with priority and retry mechanisms
- **`ValidationService`**: Data validation, normalization, and quality checking

#### Interfaces (`src/domain/interfaces/`)
- Service contracts defining clear APIs and dependencies
- Enables dependency inversion and testability
- Abstracts infrastructure concerns from business logic

#### Models (`src/domain/models/`)
- Domain entities and value objects (Product, SiteConfig, etc.)
- Data structure definitions with validation schemas

### 3. **Infrastructure Layer** (`src/infrastructure/`)
The Infrastructure Layer handles external system integrations and technical concerns.

#### Browser Management (`src/infrastructure/browser/`)
- **`BrowserService`**: Playwright browser automation and anti-detection

#### Storage (`src/infrastructure/storage/`)
- **`StorageService`**: Data persistence abstraction layer

#### Rate Limiting (`src/infrastructure/rate-limiting/`)
- **`RateLimitingService`**: Request throttling and site-specific limits

#### Adapters (`src/infrastructure/adapters/`)
- Site-specific scraping implementations (Shopify, MCAS, Generic)
- Adapter registry for dynamic site handling

### 4. **Shared Layer** (`src/shared/`)
Cross-cutting concerns and utilities used across all layers.

#### Container (`src/shared/container/`)
- **`Container`**: Simple dependency injection implementation
- Service registration and resolution

#### Types (`src/shared/types/`)
- Common type definitions and interfaces
- Service tokens for dependency injection

### 5. **CLI Layer** (`src/cli/`)
Command-line interface and application configuration.

- **`AppRunner`**: Application entry point and lifecycle management
- **`AppConfiguration`**: Configuration management and site setup

## Key Benefits

### 🎯 **Separation of Concerns**
- Each service has a single, well-defined responsibility
- Business logic separated from infrastructure concerns
- Clear boundaries between different aspects of the system

### 🔄 **Dependency Inversion**
- Services depend on abstractions (interfaces), not concrete implementations
- Easy to mock and test in isolation
- Flexible service composition and configuration

### 🏗️ **Layered Architecture**
- **Domain Layer**: Pure business logic, no external dependencies
- **Infrastructure Layer**: External system integrations
- **Application Layer**: Orchestrates business operations
- **Shared Layer**: Cross-cutting concerns

### 🧪 **Enhanced Testability**
- Services can be tested in isolation
- Easy to mock dependencies
- Clear test boundaries for unit and integration tests

### 📈 **Improved Maintainability**
- Focused, cohesive services with clear APIs
- Event-driven communication between services
- Configuration-driven behavior
- Easy to extend with new features

## Service Communication

Services communicate through:

1. **Constructor Injection**: Dependencies provided during service creation
2. **Event-Driven Architecture**: Services emit and listen to events
3. **Return Values**: Direct method calls with typed return values
4. **Interfaces**: Well-defined contracts for service interactions

## Example Usage

```typescript
// Create service container
const container = createServiceContainer(appSettings, siteConfigs);

// Get application service
const scrapingApp = container.getScrapingApplication();

// Start scraping
await scrapingApp.start();

// Add URLs to queue
scrapingApp.addUrls([
  { url: "https://example.com/products", siteName: "example" }
]);
```

## Migration Guide

The refactored architecture maintains backward compatibility while providing the new structure:

1. **Old `ScraperOrchestrator`** → **New `ScrapingApplication`**
2. **Monolithic processing** → **Service-oriented processing**
3. **Direct instantiation** → **Dependency injection**
4. **Mixed concerns** → **Layered separation**

## Testing Strategy

- **Unit Tests**: Individual service testing with mocked dependencies
- **Integration Tests**: Service composition and interaction testing
- **Architecture Tests**: Validate layered architecture constraints

## Future Enhancements

The new architecture enables easy extension with:
- New site adapters
- Additional storage backends
- Enhanced monitoring and observability
- Advanced queue management strategies
- Plugin system for custom processing