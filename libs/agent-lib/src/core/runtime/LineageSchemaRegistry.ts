import type {
  LineageSchema,
  LineageNodeDef,
  AgentLineageInfo,
} from './types.js';

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

  findBySoulToken(
    soulToken: string,
  ): { schema: LineageSchema; node: LineageNodeDef } | undefined {
    for (const schema of this.schemas.values()) {
      const node = this.findNodeBySoulTokenInTree(schema.root, soulToken);
      if (node) return { schema, node };
    }
    return undefined;
  }

  resolveLineageInfo(soulToken: string): AgentLineageInfo | undefined {
    const match = this.findBySoulToken(soulToken);
    if (!match) return undefined;
    return {
      schemaId: match.schema.id,
      nodeId: match.node.id,
      role: match.node.role,
      allowedChildren: (match.node.children ?? []).map((c) => ({
        soulToken: c.soulToken,
        nodeId: c.id,
      })),
    };
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

  private findNodeBySoulTokenInTree(
    node: LineageNodeDef,
    soulToken: string,
  ): LineageNodeDef | undefined {
    if (node.soulToken === soulToken) return node;
    for (const child of node.children ?? []) {
      const found = this.findNodeBySoulTokenInTree(child, soulToken);
      if (found) return found;
    }
    return undefined;
  }
}

export const lineageSchemaRegistry = new LineageSchemaRegistryImpl();

export function registerLineageSchema(schema: LineageSchema): void {
  lineageSchemaRegistry.register(schema);
}
