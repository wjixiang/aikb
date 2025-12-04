import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DocumentTab } from './types';
import { cn } from '@/lib/utils';
import './link-graph.css';

interface LinkGraphProps {
  activeTab: DocumentTab | null;
  className?: string;
}

interface LinkNode {
  id: string;
  title: string;
  type: 'current' | 'forward' | 'backward';
  path: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface LinkEdge {
  source: string;
  target: string;
  type: 'forward' | 'backward';
}

interface GraphData {
  nodes: LinkNode[];
  links: LinkEdge[];
}

// 使用CSS变量定义的颜色
const colors = {
  current: 'hsl(var(--primary))',
  forward: 'hsl(var(--h2))',
  backward: 'hsl(var(--h3))',
  link: 'hsl(var(--muted-foreground))',
  text: 'hsl(var(--foreground))',
  background: 'hsl(var(--background))',
  border: 'hsl(var(--border))',
};

// 模拟数据用于测试
const mockGraphData: GraphData = {
  nodes: [
    {
      id: 'current-doc',
      title: '当前文档',
      type: 'current',
      path: 'current-doc',
    },
    {
      id: 'linked-doc-1',
      title: '链接文档1',
      type: 'forward',
      path: 'linked-doc-1',
    },
    {
      id: 'linked-doc-2',
      title: '链接文档2',
      type: 'forward',
      path: 'linked-doc-2',
    },
    {
      id: 'backlink-doc-1',
      title: '引用本文档1',
      type: 'backward',
      path: 'backlink-doc-1',
    },
    {
      id: 'backlink-doc-2',
      title: '引用本文档2',
      type: 'backward',
      path: 'backlink-doc-2',
    },
  ],
  links: [
    { source: 'current-doc', target: 'linked-doc-1', type: 'forward' },
    { source: 'current-doc', target: 'linked-doc-2', type: 'forward' },
    { source: 'backlink-doc-1', target: 'current-doc', type: 'backward' },
    { source: 'backlink-doc-2', target: 'current-doc', type: 'backward' },
  ],
};

export const LinkGraph: React.FC<LinkGraphProps> = ({
  activeTab,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
  const [useMockData, setUseMockData] = useState(false);

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const { clientWidth, clientHeight } = svgRef.current.parentElement;
        setDimensions({
          width: Math.max(clientWidth, 300),
          height: Math.max(clientHeight, 200),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 切换模拟数据/真实数据
  useEffect(() => {
    const handleToggleMock = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'M') {
        setUseMockData((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleToggleMock);
    return () => window.removeEventListener('keydown', handleToggleMock);
  }, []);

  // 修复API调用：使用正确的参数名和错误处理
  useEffect(() => {
    if (!activeTab?.path) {
      setGraphData({ nodes: [], links: [] });
      return;
    }

    const fetchLinkData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 使用模拟数据进行测试
        if (useMockData) {
          setTimeout(() => {
            setGraphData(mockGraphData);
            setLoading(false);
          }, 500);
          return;
        }

        const documentId = activeTab.path;

        // 使用 forward 和 backward API 端点
        const [forwardResponse, backwardResponse] = await Promise.all([
          fetch(
            `/api/links/forward?documentId=${encodeURIComponent(documentId)}`,
          ),
          fetch(
            `/api/links/backward?documentId=${encodeURIComponent(documentId)}`,
          ),
        ]);

        if (!forwardResponse.ok || !backwardResponse.ok) {
          // 尝试使用 path 参数
          const [forwardPathResponse, backwardPathResponse] = await Promise.all(
            [
              fetch(
                `/api/links/forward?path=${encodeURIComponent(documentId)}`,
              ),
              fetch(
                `/api/links/backward?path=${encodeURIComponent(documentId)}`,
              ),
            ],
          );

          if (forwardPathResponse.ok && backwardPathResponse.ok) {
            const forwardData = await forwardPathResponse.json();
            const backwardData = await backwardPathResponse.json();
            await processLinkData(forwardData, backwardData, documentId);
            return;
          }

          throw new Error(
            `API调用失败: ${forwardResponse.status}/${backwardResponse.status}`,
          );
        }

        const forwardData = await forwardResponse.json();
        const backwardData = await backwardResponse.json();
        await processLinkData(forwardData, backwardData, documentId);
      } catch (err) {
        console.error('获取链接数据失败:', err);
        setError(err instanceof Error ? err.message : '获取链接数据失败');

        // 如果API失败，使用模拟数据
        setTimeout(() => {
          setGraphData(mockGraphData);
          setLoading(false);
        }, 500);
      } finally {
        if (!useMockData) {
          setLoading(false);
        }
      }
    };

    const processLinkData = async (
      forwardData: any,
      backwardData: any,
      documentId: string,
    ) => {
      // 转换图数据格式
      const nodes: LinkNode[] = [];
      const links: LinkEdge[] = [];
      const processedNodes = new Set<string>();

      // 添加当前节点
      nodes.push({
        id: documentId,
        title: activeTab.title,
        type: 'current',
        path: documentId,
      });
      processedNodes.add(documentId);

      // 处理 forward links
      if (forwardData.links) {
        forwardData.links.forEach((link: any) => {
          const targetId = link.targetId || link.targetPath;
          const targetTitle =
            link.targetTitle || targetId.split('/').pop() || 'Untitled';

          if (!processedNodes.has(targetId)) {
            nodes.push({
              id: targetId,
              title: targetTitle,
              type: 'forward',
              path: targetId,
            });
            processedNodes.add(targetId);
          }
          links.push({
            source: documentId,
            target: targetId,
            type: 'forward',
          });
        });
      }

      // 处理 backward links
      if (backwardData.links) {
        backwardData.links.forEach((link: any) => {
          const sourceId = link.sourceId || link.sourcePath;
          const sourceTitle =
            link.sourceTitle || sourceId.split('/').pop() || 'Untitled';

          if (!processedNodes.has(sourceId)) {
            nodes.push({
              id: sourceId,
              title: sourceTitle,
              type: 'backward',
              path: sourceId,
            });
            processedNodes.add(sourceId);
          }
          links.push({
            source: sourceId,
            target: documentId,
            type: 'backward',
          });
        });
      }

      setGraphData({ nodes, links });
    };

    fetchLinkData();
  }, [activeTab, useMockData]);

  // D3.js visualization
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Create a group for the graph
    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3
      .forceSimulation<LinkNode>(graphData.nodes)
      .force(
        'link',
        d3
          .forceLink<LinkNode, LinkEdge>(graphData.links)
          .id((d: LinkNode) => d.id)
          .distance(100)
          .strength(0.5),
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create arrow markers
    const defs = svg.append('defs');

    // Forward arrow
    defs
      .append('marker')
      .attr('id', 'arrow-forward')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', colors.forward);

    // Backward arrow
    defs
      .append('marker')
      .attr('id', 'arrow-backward')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', colors.backward);

    // Create links
    const link = g
      .append('g')
      .attr('class', 'link-graph-links')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('class', 'link-graph-link')
      .attr('stroke', (d: LinkEdge) =>
        d.type === 'forward' ? colors.forward : colors.backward,
      )
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', (d: LinkEdge) => `url(#arrow-${d.type})`);

    // Create nodes
    const node = g
      .append('g')
      .attr('class', 'link-graph-nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'link-graph-node');

    // Add circles to nodes
    node
      .append('circle')
      .attr('r', (d: LinkNode) => (d.type === 'current' ? 15 : 10))
      .attr('fill', (d: LinkNode) => {
        switch (d.type) {
          case 'current':
            return colors.current;
          case 'forward':
            return colors.forward;
          case 'backward':
            return colors.backward;
          default:
            return colors.text;
        }
      })
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8);

    // Add labels to nodes
    node
      .append('text')
      .attr('class', 'link-graph-label')
      .text((d: LinkNode) =>
        d.title.length > 12 ? d.title.substring(0, 12) + '...' : d.title,
      )
      .attr('dy', -20)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-size', '10px')
      .attr('font-family', 'sans-serif')
      .attr('text-anchor', 'middle');

    // Add drag behavior
    node.call(
      d3
        .drag<SVGGElement, LinkNode>()
        .on(
          'start',
          (
            event: d3.D3DragEvent<SVGGElement, LinkNode, LinkNode>,
            d: LinkNode,
          ) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          },
        )
        .on(
          'drag',
          (
            event: d3.D3DragEvent<SVGGElement, LinkNode, LinkNode>,
            d: LinkNode,
          ) => {
            d.fx = event.x;
            d.fy = event.y;
          },
        )
        .on(
          'end',
          (
            event: d3.D3DragEvent<SVGGElement, LinkNode, LinkNode>,
            d: LinkNode,
          ) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          },
        ),
    );

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: LinkNode) => `translate(${d.x},${d.y})`);
    });

    // Add click handlers
    node.on('click', (event: MouseEvent, d: LinkNode) => {
      if (d.type !== 'current') {
        // Dispatch custom event for opening document
        const openEvent = new CustomEvent('openDocument', {
          detail: { path: d.path, title: d.title },
        });
        window.dispatchEvent(openEvent);
      }
    });

    // Add hover effects
    node
      .on(
        'mouseover',
        function (this: SVGGElement, event: MouseEvent, d: LinkNode) {
          d3.select(this)
            .select('circle')
            .transition()
            .duration(200)
            .attr('r', d.type === 'current' ? 18 : 12)
            .attr('stroke-width', 3);

          // Highlight connected links
          link
            .transition()
            .duration(200)
            .attr('stroke-opacity', (l: LinkEdge) =>
              l.source === d.id || l.target === d.id ? 1 : 0.2,
            );
        },
      )
      .on(
        'mouseout',
        function (this: SVGGElement, event: MouseEvent, d: LinkNode) {
          d3.select(this)
            .select('circle')
            .transition()
            .duration(200)
            .attr('r', d.type === 'current' ? 15 : 10)
            .attr('stroke-width', 2);

          // Reset link opacity
          link.transition().duration(200).attr('stroke-opacity', 0.7);
        },
      );

    // Add tooltips
    node.append('title').text((d: LinkNode) => `${d.title}\n${d.path}`);

    // Initial zoom to fit
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(0.8);

    svg.call(zoom.transform, initialTransform);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions]);

  if (!activeTab) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full bg-muted/10',
          className,
        )}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            选择文档查看链接关系
          </p>
          <p className="text-xs text-muted-foreground">
            右侧将显示当前文档的双向链接图谱
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full bg-muted/10',
          className,
        )}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-muted/10', className)}>
      <div className="p-3 border-b bg-background">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              链接关系图
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {graphData.nodes.length} 个节点, {graphData.links.length} 个连接
            </p>
          </div>
          <button
            onClick={() => setUseMockData(!useMockData)}
            className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded"
            title="按 Ctrl+Shift+M 切换模拟数据"
          >
            {useMockData ? '真实数据' : '模拟数据'}
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-background">
        <svg
          ref={svgRef}
          className="w-full h-full link-graph-svg"
          style={{ cursor: 'move' }}
        />

        {graphData.nodes.length === 1 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">暂无链接关系</p>
              <p className="text-xs text-muted-foreground">
                当前文档没有引用或被引用
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t text-xs text-muted-foreground bg-background">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.current }}
            ></div>
            <span>当前文档</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.forward }}
            ></div>
            <span>引用文档</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.backward }}
            ></div>
            <span>被引用文档</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          点击节点打开文档，拖拽移动节点，按 Ctrl+Shift+M 切换数据
        </p>
      </div>
    </div>
  );
};
