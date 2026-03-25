import 'reflect-metadata';
import { injectable, inject, Container } from 'inversify';
import { TYPES } from '../../core/di/types.js';
import type { ToolComponent } from './toolComponent.js';

/**
 * Factory for creating ToolComponent instances with dependency injection.
 *
 * This factory uses Inversify's container.resolve() which automatically
 * resolves @inject() decorated constructor parameters.
 *
 * @example
 * ```typescript
 * // Component using @inject()
 * class MyComponent extends ToolComponent {
 *   constructor(
 *     @inject(TYPES.IA2AHandler) private a2aHandler: IA2AHandler,
 *   ) {
 *     super();
 *   }
 * }
 *
 * // Create with factory
 * const component = factory.create(MyComponent);
 * ```
 */
@injectable()
export class ToolComponentFactory {
  constructor(@inject(TYPES.Container) private container: Container) {}

  /**
   * Create a component instance with DI-injected dependencies.
   * Uses container.resolve() which automatically resolves @inject() params.
   *
   * @param componentClass - The component class to instantiate
   * @returns A new instance with dependencies injected
   */
  create<T extends ToolComponent>(componentClass: new (...args: any[]) => T): T {
    return this.container.resolve(componentClass);
  }
}
