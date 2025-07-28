/**
 * Adapter system exports
 */

export {
  BaseAdapter,
  PageType,
  type DiscoveryResult,
  type ExtractionContext,
} from "./base-adapter.js";
export { ShopifyAdapter } from "./shopify-adapter.js";
export { MCASAdapter } from "./mcas-adapter.js";
export { GenericAdapter } from "./generic-adapter.js";
export { AdapterRegistry, adapterRegistry } from "./adapter-registry.js";
