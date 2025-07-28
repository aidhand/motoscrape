import { ServiceToken } from "../types/service.types.js";

/**
 * Simple dependency injection container
 */
export class Container {
  private services = new Map<ServiceToken, any>();
  private factories = new Map<ServiceToken, () => any>();
  private singletons = new Set<ServiceToken>();

  /**
   * Register a service instance
   */
  register<T>(token: ServiceToken, instance: T): void {
    this.services.set(token, instance);
  }

  /**
   * Register a factory function for creating service instances
   */
  registerFactory<T>(token: ServiceToken, factory: () => T, singleton = true): void {
    this.factories.set(token, factory);
    if (singleton) {
      this.singletons.add(token);
    }
  }

  /**
   * Get a service instance
   */
  get<T>(token: ServiceToken): T {
    // Check if instance already exists
    if (this.services.has(token)) {
      return this.services.get(token);
    }

    // Check if factory exists
    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      const instance = factory();
      
      // Store singleton instances
      if (this.singletons.has(token)) {
        this.services.set(token, instance);
      }
      
      return instance;
    }

    throw new Error(`Service not registered for token: ${token.toString()}`);
  }

  /**
   * Check if a service is registered
   */
  has(token: ServiceToken): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): ServiceToken[] {
    return [...new Set([...this.services.keys(), ...this.factories.keys()])];
  }
}

// Export singleton instance
export const container = new Container();