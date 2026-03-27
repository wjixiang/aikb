import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  api,
  type AgentInfo,
  type TopologyNode,
  type TopologyEdge,
  type EdgeActivity,
} from '@/lib/api';
import { Network } from 'lucide-react';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  nodeType: string;
  status?: string;
  agentType?: string;
}

type EdgeActivityStatus = 'pending' | 'acknowledged' | 'completed' | 'failed';

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode | string;
  target: GraphNode | string;
  edgeType?: string;
  activity?: EdgeActivityStatus;
  conversationCount?: number;
}

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  idle: '#eab308',
  stopped: '#ef4444',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  coordinator: '#6366f1',
  router: '#8b5cf6',
  worker: '#3b82f6',
};

const SOUL_TYPE_COLORS = [
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#a855f7',
  '#e11d48',
  '#0ea5e9',
  '#84cc16',
];

const EDGE_ACTIVITY_STYLES: Record<
  string,
  { stroke: string; width: number; opacity: number; dasharray?: string }
> = {
  pending: {
    stroke: '#f59e0b',
    width: 2,
    opacity: 1,
    dasharray: '4 6',
  },
  acknowledged: {
    stroke: '#22c55e',
    width: 2.5,
    opacity: 1,
    dasharray: '8 4',
  },
  completed: {
    stroke: '#3b82f6',
    width: 2,
    opacity: 0.8,
  },
  failed: {
    stroke: '#ef4444',
    width: 2,
    opacity: 0.8,
  },
};

function getTypeColor(
  node: GraphNode,
  soulColors: Map<string, string>,
): string {
  if (node.status && STATUS_COLORS[node.status])
    return STATUS_COLORS[node.status];
  if (NODE_TYPE_COLORS[node.nodeType]) return NODE_TYPE_COLORS[node.nodeType];
  if (node.agentType && soulColors.has(node.agentType))
    return soulColors.get(node.agentType)!;
  return '#64748b';
}

export function AgentTopology({
  onSelectAgent,
}: {
  onSelectAgent?: (instanceId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null,
  );
  const soulColorsRef = useRef<Map<string, string>>(new Map());
  const sizeRef = useRef({ width: 800, height: 500 });
  const [size, setSize] = useState({ width: 800, height: 500 });
  const activityRef = useRef<Map<string, EdgeActivity>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const newSize = {
            width: Math.floor(width),
            height: Math.floor(height),
          };
          sizeRef.current = newSize;
          setSize(newSize);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Inject CSS animation for active edges
  useEffect(() => {
    const styleId = 'edge-activity-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes dash-flow-pending {
        to { stroke-dashoffset: -20; }
      }
      @keyframes dash-flow-ack {
        to { stroke-dashoffset: -24; }
      }
      .edge-pending {
        animation: dash-flow-pending 1.2s linear infinite;
      }
      .edge-acknowledged {
        animation: dash-flow-ack 0.8s linear infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  const render = useCallback(
    (
      agents: AgentInfo[],
      nodes: TopologyNode[],
      edges: TopologyEdge[],
      activities: EdgeActivity[],
    ) => {
      if (!svgRef.current) return;

      const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);

      // Build soul color map
      const soulColors = soulColorsRef.current;
      if (soulColors.size === 0) {
        const types = [...new Set(agents.map((a) => a.agentType))];
        types.forEach((t, i) =>
          soulColors.set(t, SOUL_TYPE_COLORS[i % SOUL_TYPE_COLORS.length]),
        );
      }

      const agentMap = new Map(agents.map((a) => [a.instanceId, a]));

      // Build activity map
      const activityMap = new Map<string, EdgeActivity>();
      for (const a of activities) {
        activityMap.set(`${a.from}->${a.to}`, a);
      }
      activityRef.current = activityMap;

      const graphNodes: GraphNode[] =
        agents.length > 0
          ? agents.map((a) => ({
              id: a.instanceId,
              label: a.alias || a.name,
              nodeType:
                a.agentType === 'coordinator' ? 'coordinator' : 'worker',
              status: a.status,
              agentType: a.agentType,
            }))
          : nodes.map((n) => ({
              id: n.instanceId,
              label: n.instanceId,
              nodeType: n.nodeType ?? 'worker',
              agentType: undefined,
            }));

      const graphLinks: GraphLink[] = edges.map((e) => {
        const activity = activityMap.get(`${e.from}->${e.to}`);
        return {
          source: e.from,
          target: e.to,
          edgeType: e.edgeType,
          activity: activity?.status,
          conversationCount: activity?.conversationCount,
        };
      });

      // Clean up previous simulation
      simulationRef.current?.stop();

      // Simulation
      const simulation = d3
        .forceSimulation<GraphNode>(graphNodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(graphLinks)
            .id((d) => d.id)
            .distance(120),
        )
        .force('charge', d3.forceManyBody().strength(-400))
        .force(
          'center',
          d3.forceCenter(sizeRef.current.width / 2, sizeRef.current.height / 2),
        )
        .force('collision', d3.forceCollide().radius(40));

      simulationRef.current = simulation;

      svg.selectAll('*').remove();

      // Arrow markers - one per status + default
      const defs = svg.append('defs');
      const markerConfigs = [
        { id: 'arrowhead', fill: '#94a3b8' },
        { id: 'arrowhead-pending', fill: '#f59e0b' },
        { id: 'arrowhead-acknowledged', fill: '#22c55e' },
        { id: 'arrowhead-completed', fill: '#3b82f6' },
        { id: 'arrowhead-failed', fill: '#ef4444' },
      ];
      for (const mc of markerConfigs) {
        defs
          .append('marker')
          .attr('id', mc.id)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 28)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('fill', mc.fill)
          .attr('d', 'M0,-5L10,0L0,5');
      }

      const g = svg.append('g');

      // Zoom
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      // Links
      const link = g
        .append('g')
        .selectAll<SVGLineElement, GraphLink>('line')
        .data(graphLinks)
        .join('line')
        .attr('stroke', (d) => {
          const style = d.activity ? EDGE_ACTIVITY_STYLES[d.activity] : null;
          return style?.stroke ?? '#94a3b8';
        })
        .attr('stroke-width', (d) => {
          const style = d.activity ? EDGE_ACTIVITY_STYLES[d.activity] : null;
          return style?.width ?? 1.5;
        })
        .attr('stroke-opacity', (d) => {
          const style = d.activity ? EDGE_ACTIVITY_STYLES[d.activity] : null;
          return style?.opacity ?? 0.6;
        })
        .attr('stroke-dasharray', (d) => {
          const style = d.activity ? EDGE_ACTIVITY_STYLES[d.activity] : null;
          return style?.dasharray ?? null;
        })
        .attr('marker-end', (d) => {
          if (d.activity) return `url(#arrowhead-${d.activity})`;
          return 'url(#arrowhead)';
        })
        .classed('edge-pending', (d) => d.activity === 'pending')
        .classed('edge-acknowledged', (d) => d.activity === 'acknowledged');

      // Edge tooltip on hover
      const edgeTooltip = svg
        .append('text')
        .style('display', 'none')
        .style('position', 'absolute')
        .attr('fill', '#f8fafc')
        .attr('font-size', 11)
        .attr('pointer-events', 'none');

      link
        .on('mouseenter', (_event, d) => {
          const src = typeof d.source === 'string' ? d.source : d.source.id;
          const tgt = typeof d.target === 'string' ? d.target : d.target.id;
          const statusLabel = d.activity ?? 'idle';
          const countLabel =
            d.conversationCount !== undefined
              ? ` (${d.conversationCount} msgs)`
              : '';
          edgeTooltip
            .text(`${src} -> ${tgt}: ${statusLabel}${countLabel}`)
            .style('display', 'block');
        })
        .on('mousemove', (event) => {
          edgeTooltip
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 8}px`);
        })
        .on('mouseleave', () => {
          edgeTooltip.style('display', 'none');
        });

      // Node groups
      const node = g
        .append('g')
        .selectAll<SVGGElement, GraphNode>('g')
        .data(graphNodes)
        .join('g')
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }),
        );

      // Node circles
      node
        .append('circle')
        .attr('r', 18)
        .attr('fill', (d) => getTypeColor(d, soulColors))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 2)
        .attr('fill-opacity', 0.85)
        .style('cursor', 'pointer');

      // Status dot
      node
        .filter((d) => !!d.status)
        .append('circle')
        .attr('cx', 12)
        .attr('cy', -12)
        .attr('r', 5)
        .attr('fill', (d) => STATUS_COLORS[d.status ?? 'stopped'])
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1.5);

      // Labels
      node
        .append('text')
        .text((d) => d.label)
        .attr('text-anchor', 'middle')
        .attr('dy', 32)
        .attr('fill', '#e2e8f0')
        .attr('font-size', 11)
        .attr('font-weight', 500)
        .attr('pointer-events', 'none');

      // Agent type label
      node
        .filter((d) => !!(d.agentType && d.agentType !== d.label))
        .append('text')
        .text((d) => d.agentType!)
        .attr('text-anchor', 'middle')
        .attr('dy', 44)
        .attr('fill', '#94a3b8')
        .attr('font-size', 9)
        .attr('pointer-events', 'none');

      // Tooltip on hover
      const tooltip = svg
        .append('text')
        .style('display', 'none')
        .style('position', 'absolute')
        .attr('fill', '#f8fafc')
        .attr('font-size', 11)
        .attr('pointer-events', 'none');

      node
        .on('mouseenter', (_event, d) => {
          const agent = agentMap.get(d.id);
          const info = agent
            ? `${agent.name}\nStatus: ${agent.status}\nType: ${agent.agentType}`
            : `${d.label}\nType: ${d.nodeType}`;
          tooltip.text(info).style('display', 'block');
        })
        .on('mousemove', (event) => {
          tooltip
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 8}px`);
        })
        .on('mouseleave', () => {
          tooltip.style('display', 'none');
        });

      node.on('click', (_event, d) => {
        if (onSelectAgent) onSelectAgent(d.id);
      });

      // Tick
      simulation.on('tick', () => {
        link
          .attr('x1', (d) => (d.source as GraphNode).x!)
          .attr('y1', (d) => (d.source as GraphNode).y!)
          .attr('x2', (d) => (d.target as GraphNode).x!)
          .attr('y2', (d) => (d.target as GraphNode).y!);

        node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });
    },
    [size, onSelectAgent],
  );

  const prevDataRef = useRef<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, topologyRes, activityRes] = await Promise.all([
          api.runtime
            .agents()
            .catch(() => ({ success: false, data: [], count: 0 })),
          api.runtime.topology().catch(() => ({
            success: false,
            data: { nodes: [], edges: [], size: { nodes: 0, edges: 0 } },
          })),
          api.runtime
            .edgeActivity()
            .catch(() => ({ success: false, data: [] })),
        ]);

        const agents: AgentInfo[] = agentsRes.success ? agentsRes.data : [];
        const topology = topologyRes.success
          ? topologyRes.data
          : { nodes: [], edges: [], size: { nodes: 0, edges: 0 } };
        const activities: EdgeActivity[] = activityRes.success
          ? activityRes.data
          : [];

        const raw = JSON.stringify({ agents, topology, activities });
        if (raw === prevDataRef.current) return;
        prevDataRef.current = raw;

        render(agents, topology.nodes, topology.edges, activities);
      } catch {
        // silently retry on next interval
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      clearInterval(interval);
      simulationRef.current?.stop();
    };
  }, [render]);

  return (
    <Card className="w-full h-full border-2 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Agent Topology
          </span>
          <span id="topology-count" className="text-xs text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0">
        <div ref={containerRef} className="flex-1 min-h-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="w-full h-full rounded-lg bg-muted/30"
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: 'grab' }}
          />
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Drag nodes to rearrange. Scroll to zoom.</span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5"
              style={{ backgroundColor: '#94a3b8' }}
            />
            idle
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5"
              style={{
                backgroundColor: '#f59e0b',
                borderTop: '1px dashed #f59e0b',
                height: 0,
              }}
            />
            waiting ACK
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5"
              style={{
                backgroundColor: '#22c55e',
                borderTop: '1px dashed #22c55e',
                height: 0,
              }}
            />
            ACK'd
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5"
              style={{ backgroundColor: '#3b82f6' }}
            />
            completed
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5"
              style={{ backgroundColor: '#ef4444' }}
            />
            failed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
