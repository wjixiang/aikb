import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  api,
  type LineageSchema,
  type LineageSchemaSummary,
  type LineageNodeDef,
} from '@/lib/api';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Play,
  Loader2,
} from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  coordinator:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  worker: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
};

const ROLE_DOT: Record<string, string> = {
  coordinator: 'bg-[var(--color-node-coordinator)]',
  worker: 'bg-[var(--color-node-worker)]',
};

function TreeNode({
  node,
  depth = 0,
}: {
  node: LineageNodeDef;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-muted/50 cursor-default group"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <span
          className={`w-2 h-2 rounded-full shrink-0 ${ROLE_DOT[node.role] ?? 'bg-gray-400'}`}
        />

        <span className="text-sm font-medium truncate">
          {node.name ?? node.soulToken}
        </span>

        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[node.role] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {node.role}
        </span>

        <span className="text-[10px] text-muted-foreground font-mono truncate">
          {node.soulToken}
        </span>

        {hasChildren && (
          <span className="text-[10px] text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            {node.children!.length}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-muted-foreground/20"
            style={{ left: `${depth * 20 + 13}px` }}
          />
          {node.children!.map((child) => (
            <TreeNode key={child.soulToken} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function countNodes(node: LineageNodeDef): {
  total: number;
  byRole: Record<string, number>;
} {
  const byRole: Record<string, number> = {};
  let total = 0;

  function walk(n: LineageNodeDef) {
    total++;
    byRole[n.role] = (byRole[n.role] || 0) + 1;
    n.children?.forEach(walk);
  }
  walk(node);

  return { total, byRole };
}

function SchemaCard({ schema }: { schema: LineageSchema }) {
  const [instantiating, setInstantiating] = useState(false);

  const { total, byRole } = countNodes(schema.root);

  const handleInstantiate = async () => {
    setInstantiating(true);
    try {
      await api.runtime.instantiateLineage(schema.id);
    } catch {
    } finally {
      setInstantiating(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-4 w-4 shrink-0" />
            <span className="truncate">{schema.name}</span>
          </div>
          <button
            onClick={handleInstantiate}
            disabled={instantiating}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
          >
            {instantiating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Instantiate
          </button>
        </CardTitle>
        {schema.description && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span>
            ID: <code className="text-foreground">{schema.id}</code>
          </span>
          <span>{total} nodes</span>
          {Object.entries(byRole).map(([role, count]) => (
            <span key={role} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[role]}`} />
              {count} {role}
            </span>
          ))}
        </div>
        <div className="border-t pt-2">
          <TreeNode node={schema.root} />
        </div>
      </CardContent>
    </Card>
  );
}

export function LineageTree() {
  const [schemas, setSchemas] = useState<LineageSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchSchemas = useCallback(async () => {
    try {
      const res = await api.runtime.lineages();
      if (!res.success) {
        setError('Failed to load lineages');
        return;
      }
      const raw = res.data;
      const summaries: LineageSchemaSummary[] = Array.isArray(raw)
        ? raw
        : (Object.values(raw) as LineageSchemaSummary[]);
      if (summaries.length === 0) {
        setSchemas([]);
        setSelectedId(null);
        return;
      }

      if (!selectedId || !summaries.find((s) => s.id === selectedId)) {
        setSelectedId(summaries[0].id);
      }

      const details = await Promise.all(
        summaries.map((s) => api.runtime.lineage(s.id).catch(() => null)),
      );
      setSchemas(
        details
          .filter((d): d is NonNullable<typeof d> => d !== null && d.success)
          .map((d) => d.data),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchSchemas();
    const interval = setInterval(fetchSchemas, 30000);
    return () => clearInterval(interval);
  }, [fetchSchemas]);

  if (loading) {
    return (
      <Card className="h-full w-full border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Lineage Schemas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full w-full border-2 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <GitBranch className="h-5 w-5" />
            Lineage Schemas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (schemas.length === 0) {
    return (
      <Card className="h-full w-full border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Lineage Schemas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No lineage schemas registered
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full w-full border-2 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Lineage Schemas
          </span>
          <span className="text-xs text-muted-foreground">
            {schemas.length} registered
          </span>
        </CardTitle>
        {schemas.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {schemas.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                  selectedId === s.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        {selectedId && (
          <SchemaCard
            key={selectedId}
            schema={schemas.find((s) => s.id === selectedId)!}
          />
        )}
      </CardContent>
    </Card>
  );
}
