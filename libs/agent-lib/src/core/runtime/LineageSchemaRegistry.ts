import type { LineageSchema, LineageNodeDef } from './types.js';

class LineageSchemaRegistryImpl {
  private schemas = new Map<string, LineageSchema>();

  register(schema: LineageSchema): void {
    this.schemas.set(schema.id, schema);
  }

  get(id: string): LineageSchema | undefined {
    return this.schemas.get(id);
  }

  getAll(): LineageSchema[] {
    return Array.from(this.schemas.values());
  }

  has(id: string): boolean {
    return this.schemas.has(id);
  }

  findNode(schemaId: string, nodeId: string): LineageNodeDef | undefined {
    const schema = this.schemas.get(schemaId);
    if (!schema) return undefined;
    return this.findNodeInTree(schema.root, nodeId);
  }

  private findNodeInTree(
    node: LineageNodeDef,
    nodeId: string,
  ): LineageNodeDef | undefined {
    if (node.id === nodeId) return node;
    for (const child of node.children ?? []) {
      const found = this.findNodeInTree(child, nodeId);
      if (found) return found;
    }
    return undefined;
  }
}

export const lineageSchemaRegistry = new LineageSchemaRegistryImpl();

export function registerLineageSchema(schema: LineageSchema): void {
  lineageSchemaRegistry.register(schema);
}
