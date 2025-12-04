import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { HoverCard, HoverCardContent, HoverCardTrigger } from 'ui';
import { Skeleton } from 'ui';
import { Badge } from 'ui';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkWikiLink from 'remark-wiki-link';
import { visit } from 'unist-util-visit';
// Define our own types since unist types are not properly available
interface UnistNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, any>;
  children?: UnistNode[];
}

interface UnistParent {
  type: string;
  children: UnistNode[];
}
import { useRouter } from 'next/navigation';
import './reference-hover-card.css';
import './wiki-links.css';
import rehypeMermaid from 'rehype-mermaid';
import mermaid from 'mermaid';
import rehypeKatex from 'rehype-katex';
import rehypeCallouts from 'rehype-callouts';

export type Reference = {
  title: string;
  page_number?: string;
  score: number;
  content: string;
  presigned_url: string;
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  basePath?: string;
  embedDepth?: number;
  references?: Reference[];
  onOpenDocument?: (path: string) => void;
  useWorkspace?: boolean;
  isRenderRef?: boolean;
  fontColor?: string;
}

if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'monospace',
  });
  mermaid.init(undefined, '.mermaid');
}

const contentCache = new Map<string, string>();
const htmlCache = new Map<string, string>();
const documentExistenceCache = new Map<string, boolean>();

function remarkReferences(references: Reference[]) {
  return () => (tree: any) => {
    visit(
      tree,
      'text',
      (
        node: UnistNode,
        index: number | undefined,
        parent: UnistParent | undefined,
      ) => {
        if (!parent || !Array.isArray(parent.children)) {
          return;
        }

        if (!node.value) return;
        const parts = node.value.split(/(\[ref:\d+\])/g);
        if (parts.length <= 1) return;

        const newNodes: any[] = [];

        for (let i = 0; i < parts.length; i++) {
          if (!parts[i]) continue;

          const refMatch = parts[i].match(/^\[ref:(\d+)\]$/);

          if (refMatch) {
            const refId = refMatch[1];
            newNodes.push({
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['reference'],
                'data-ref-id': String(Number(refId) - 1),
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['reference-number'],
                  },
                  children: [
                    {
                      type: 'text',
                      value: `[${refId}]`,
                    },
                  ],
                },
              ],
            });
          } else {
            newNodes.push({ type: 'text', value: parts[i] });
          }
        }

        if (newNodes.length > 0) {
          parent.children.splice(index as number, 1, ...newNodes);
          return (index as number) + newNodes.length - 1;
        }
      },
    );
  };
}

function remarkEmbeds() {
  return () => (tree: any) => {
    visit(
      tree,
      'text',
      (node: UnistNode, index: any, parent: UnistParent | undefined) => {
        if (
          typeof node.value !== 'string' ||
          !parent ||
          !Array.isArray(parent.children)
        ) {
          return;
        }

        if (!node.value) return;
        const parts = node.value.split(/(!\[\[.*?\]\])/g);
        if (parts.length <= 1) return;

        const newNodes: any[] = [];

        for (let i = 0; i < parts.length; i++) {
          if (!parts[i]) continue;

          const embedMatch = parts[i].match(/^!\[\[(.*?)\]\]$/);

          if (embedMatch) {
            const embedTarget = embedMatch[1].trim();
            const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff)$/i.test(
              embedTarget,
            );

            if (isImage) {
              newNodes.push({
                type: 'html',
                value: `<div class="embed embed-image" data-embed-target="${embedTarget}" data-embed-type="image">
                <div class="embed-content">
                  <div class="embed-loading">加载图片中...</div>
                </div>
              </div>`,
              } as any);
            } else {
              newNodes.push({
                type: 'html',
                value: `<div class="embed" data-embed-target="${embedTarget}" data-embed-type="document">
                
                <div class="embed-content">
                  <div class="embed-loading">加载中...</div>
                </div>
              </div>`,
              } as any);
            }
          } else {
            newNodes.push({ type: 'text', value: parts[i] } as any);
          }
        }

        if (newNodes.length > 0) {
          if (typeof index === 'number' && parent) {
            parent.children.splice(index, 1, ...newNodes);
            return index + newNodes.length - 1;
          }
          return;
        }
      },
    );
  };
}

function remarkPDFCallouts() {
  return (tree: any) => {
    visit(tree, 'text', (node: UnistNode) => {
      if (typeof node.value === 'string') {
        node.value = node.value.replace(/\[!PDF(\|[^\]]*)?\]/g, '[!note]');
      }
    });
  };
}

async function renderMarkdown(
  content: string,
  basePath: string,
  references: Reference[],
  useWorkspace: boolean = false,
  isRenderRef = true,
): Promise<string> {
  const cacheKey = `${content}:${basePath}:${useWorkspace}:${isRenderRef}:${references.length}`;
  if (htmlCache.has(cacheKey)) {
    return htmlCache.get(cacheKey)!;
  }

  try {
    // Remove YAML frontmatter before processing
    const cleanContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

    const result = isRenderRef
      ? await unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkMath)
          .use(remarkPDFCallouts)
          .use(remarkWikiLink, {
            pageResolver: (name: string) => [
              encodeURIComponent(name.split('|')[0].trim()),
            ],
            hrefTemplate: (permalink: string) =>
              useWorkspace
                ? `workspace:${permalink}`
                : `${basePath}/${permalink}`,
            aliasDivider: '|',
          })
          .use(remarkEmbeds())
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeCallouts, {
            callouts: {
              PDF: {
                title: 'Note',
                indicator:
                  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
              },
            },
          })
          .use(rehypeRaw)
          .use(rehypeKatex)
          .use(rehypeMermaid)
          .use(rehypeHighlight)
          .use(rehypeStringify)
          .use(remarkReferences(references))
          .process(cleanContent)
      : await unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkMath)
          .use(remarkPDFCallouts)
          .use(remarkWikiLink, {
            pageResolver: (name: string) => [
              encodeURIComponent(name.split('|')[0].trim()),
            ],
            hrefTemplate: (permalink: string) =>
              useWorkspace
                ? `workspace:${permalink}`
                : `${basePath}/${permalink}`,
            aliasDivider: '|',
          })
          .use(remarkEmbeds())
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeCallouts, {
            callouts: {
              PDF: {
                title: 'Note',
                indicator:
                  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
              },
            },
          })
          .use(rehypeRaw)
          .use(rehypeKatex)
          .use(rehypeMermaid)
          .use(rehypeHighlight)
          .use(rehypeStringify)
          .process(cleanContent);

    const html = String(result);
    htmlCache.set(cacheKey, html);
    return html;
  } catch (error) {
    console.error('渲染Markdown失败:', error);
    return `<div class="markdown-error">渲染失败: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

const YamlMetadata: React.FC<{ tags: string[]; aliases: string[] }> = ({
  tags,
  aliases,
}) => {
  if (tags.length === 0 && aliases.length === 0) return null;

  return (
    <div className="yaml-metadata mb-4 pb-3 border-b">
      {aliases.length > 0 && (
        <div className="aliases-section mb-2">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Aliases:
          </span>
          {aliases.map((alias, index) => (
            <Badge
              key={`alias-${index}`}
              variant="secondary"
              className="mr-1 mb-1"
            >
              {alias}
            </Badge>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div className="tags-section">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Tags:
          </span>
          {tags.map((tag, index) => (
            <Badge key={`tag-${index}`} variant="outline" className="mr-1 mb-1">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  basePath = '/wiki',
  embedDepth = 0,
  references,
  onOpenDocument,
  useWorkspace = false,
  isRenderRef = true,
  fontColor,
}) => {
  const [html, setHtml] = useState<string>('');
  const [yamlData, setYamlData] = useState<{
    tags: string[];
    aliases: string[];
  }>({ tags: [], aliases: [] });
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentExistence, setDocumentExistence] = useState<
    Map<string, boolean>
  >(new Map());
  const renderedRef = useRef<HTMLDivElement>(null);
  const embedsLoadedRef = useRef<boolean>(false);
  const maxEmbedDepth = 2;

  const extractLinks = useCallback((text: string): string[] => {
    const linkRegex = /(?:!?\[\[(.*?)(?:\|.*?)?\]\])/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      const linkText = match[1].trim();
      if (!links.includes(linkText)) {
        links.push(linkText);
      }
    }
    return links;
  }, []);

  const checkDocumentExistence = useCallback(
    async (documentPath: string): Promise<boolean> => {
      if (documentExistenceCache.has(documentPath)) {
        return documentExistenceCache.get(documentPath)!;
      }

      try {
        // Normalize the document path for better matching
        let searchPath = documentPath.trim();

        // Remove .md extension if present
        if (searchPath.endsWith('.md')) {
          searchPath = searchPath.slice(0, -3);
        }

        // Create search patterns for better matching
        const searchPatterns = [
          searchPath, // exact match
          `${searchPath}.md`, // with extension
          searchPath.split('/').pop() || searchPath, // just filename
        ];

        // Remove duplicates
        const uniquePatterns = [...new Set(searchPatterns)];

        for (const pattern of uniquePatterns) {
          if (!pattern) continue;

          const response = await fetch(
            `/api/knowledge/list?file=${encodeURIComponent(pattern)}`,
          );
          if (!response.ok) continue;

          const data = await response.json();

          // Check if any document matches
          if (data.results && data.results.length > 0) {
            // More precise matching - check if the actual filename matches
            const normalizedTarget = pattern.toLowerCase();
            const hasExactMatch = data.results.some(
              (doc: { path: string; title?: string }) => {
                const docPath = doc.path.toLowerCase();
                const docTitle = (doc.title || '').toLowerCase();
                const docFilename =
                  doc.path.split('/').pop()?.toLowerCase() || '';

                return (
                  docPath.includes(normalizedTarget) ||
                  docTitle.includes(normalizedTarget) ||
                  docFilename.replace('.md', '') ===
                    normalizedTarget.replace('.md', '')
                );
              },
            );

            if (hasExactMatch) {
              documentExistenceCache.set(documentPath, true);
              return true;
            }
          }
        }

        documentExistenceCache.set(documentPath, false);
        return false;
      } catch (error) {
        console.error('检查文档存在性失败:', error);
        documentExistenceCache.set(documentPath, false);
        return false;
      }
    },
    [],
  );

  const findDocumentKey = useCallback(
    async (documentName: string): Promise<string | null> => {
      try {
        // Normalize the document name for better matching
        let searchName = documentName.trim();

        // Remove .md extension if present
        if (searchName.endsWith('.md')) {
          searchName = searchName.slice(0, -3);
        }

        // Create search patterns
        const searchPatterns = [
          searchName,
          `${searchName}.md`,
          searchName.split('/').pop() || searchName,
        ];

        const uniquePatterns = [...new Set(searchPatterns)];

        for (const pattern of uniquePatterns) {
          if (!pattern) continue;

          const response = await fetch(
            `/api/knowledge/list?file=${encodeURIComponent(pattern)}`,
          );
          if (!response.ok) continue;

          const data = await response.json();

          if (data.results && data.results.length > 0) {
            // Find the best match
            const normalizedTarget = pattern.toLowerCase();

            // Look for exact filename match first
            const exactMatch = data.results.find(
              (doc: { path: string; title?: string }) => {
                const docFilename = doc.path
                  .split('/')
                  .pop()
                  ?.replace('.md', '')
                  .toLowerCase();
                return docFilename === normalizedTarget.replace('.md', '');
              },
            );

            if (exactMatch) {
              return exactMatch.path;
            }

            // Return first match as fallback
            return data.results[0].path;
          }
        }

        return null;
      } catch (error) {
        console.error('查找文档key失败:', error);
        return null;
      }
    },
    [],
  );

  const processWikiLinksWithExistence = useCallback(
    async (htmlContent: string): Promise<string> => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const wikiLinks = doc.querySelectorAll(
        'a[href^="/wiki/"], a[href^="workspace:"]',
      );

      const existenceChecks = Array.from(wikiLinks).map(async (link) => {
        const href = link.getAttribute('href') || '';
        let documentName = '';

        if (href.startsWith('workspace:')) {
          documentName = href.replace('workspace:', '');
        } else if (href.startsWith('/wiki/')) {
          documentName = href.replace('/wiki/', '');
        }

        if (documentName) {
          documentName = decodeURIComponent(documentName);
          const actualKey = await findDocumentKey(documentName);
          const exists = actualKey !== null;

          link.classList.toggle('wiki-link-nonexistent', !exists);
          link.setAttribute('data-exists', exists.toString());

          // Update href to use actual S3 key
          if (actualKey) {
            if (href.startsWith('workspace:')) {
              link.setAttribute('href', `workspace:${actualKey}`);
            } else {
              link.setAttribute('href', `/wiki/${actualKey}`);
            }
          }
        }
      });

      await Promise.all(existenceChecks);
      return doc.body.innerHTML;
    },
    [checkDocumentExistence, findDocumentKey],
  );

  const parseYamlFrontmatter = useCallback(
    (
      content: string,
    ): {
      hasExcalidraw: boolean;
      yamlBlock: string | null;
      tags: string[];
      aliases: string[];
      cleanContent: string;
    } => {
      const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
      if (!yamlMatch) {
        return {
          hasExcalidraw: false,
          yamlBlock: null,
          tags: [],
          aliases: [],
          cleanContent: content,
        };
      }

      const yamlContent = yamlMatch[1];
      const cleanContent = content.replace(yamlMatch[0], '');

      // Parse tags
      let tags: string[] = [];
      const tagsArrayMatch = yamlContent.match(/tags:\s*\[([^\]]+)\]/i);
      if (tagsArrayMatch) {
        tags = tagsArrayMatch[1]
          .split(',')
          .map((tag) => tag.trim().replace(/["']/g, ''));
      } else {
        const tagsListMatch = yamlContent.match(
          /tags:\s*\n([\s\S]*?)(?=\n\w+:|$)/i,
        );
        if (tagsListMatch) {
          const listContent = tagsListMatch[1];
          const tagMatches = listContent.matchAll(/-\s*([^\n]+)/g);
          tags = Array.from(tagMatches, (match) =>
            match[1].trim().replace(/["']/g, ''),
          );
        }
      }

      // Parse aliases
      let aliases: string[] = [];
      const aliasesArrayMatch = yamlContent.match(/aliases:\s*\[([^\]]+)\]/i);
      if (aliasesArrayMatch) {
        aliases = aliasesArrayMatch[1]
          .split(',')
          .map((alias) => alias.trim().replace(/["']/g, ''));
      } else {
        const aliasesListMatch = yamlContent.match(
          /aliases:\s*\n([\s\S]*?)(?=\n\w+:|$)/i,
        );
        if (aliasesListMatch) {
          const listContent = aliasesListMatch[1];
          const aliasMatches = listContent.matchAll(/-\s*([^\n]+)/g);
          aliases = Array.from(aliasMatches, (match) =>
            match[1].trim().replace(/["']/g, ''),
          );
        }
      }

      const hasExcalidraw = tags.some(
        (tag) => tag.toLowerCase() === 'excalidraw',
      );
      return {
        hasExcalidraw,
        yamlBlock: yamlMatch[0],
        tags,
        aliases,
        cleanContent,
      };
    },
    [],
  );

  const fetchAndRenderEmbeddedContent = useCallback(
    async (title: string): Promise<string> => {
      if (embedDepth >= maxEmbedDepth) {
        return `<div class="embed-max-depth">已达到最大嵌入深度 (${maxEmbedDepth})</div>`;
      }

      if (contentCache.has(title)) {
        return contentCache.get(title)!;
      }

      try {
        console.log('Fetching embedded content for:', title);

        // First, find the actual document key
        const actualKey = await findDocumentKey(title);
        if (!actualKey) {
          return `<div class="embed-error">文档不存在: ${title}</div>`;
        }

        // Use the knowledge text API to get content - note: uses 'key' parameter
        const response = await fetch(
          `/api/knowledge/text?key=${encodeURIComponent(actualKey)}`,
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new Error(
            `获取内容失败: ${response.status} ${errorData.message || response.statusText}`,
          );
        }

        const data = await response.json();
        if (!data?.content) {
          return `<div class="embed-error">内容为空或无法加载: ${title}</div>`;
        }

        const docContent = data.content;

        // Parse YAML metadata and get clean content
        const { hasExcalidraw, tags, aliases, cleanContent } =
          parseYamlFrontmatter(docContent);

        if (hasExcalidraw) {
          // Treat as image - convert to SVG filename
          // Transform path from "Excalidraw/脑膜尾征【MRI增强】.md.svg" to "脑膜尾征【MRI增强】.svg"
          let svgFileName = `${actualKey}.svg`;

          // Remove .md extension if present in the filename
          svgFileName = svgFileName.replace(/\.md\.svg$/, '.svg');

          // Remove "Excalidraw/" prefix if present
          svgFileName = svgFileName.replace(/^Excalidraw\//, '');

          console.log(
            'Excalidraw document detected, treating as image:',
            svgFileName,
          );

          // Use image rendering for excalidraw content
          const imageHtml = await fetchAndRenderEmbeddedImage(svgFileName);
          contentCache.set(title, imageHtml);
          return imageHtml;
        }

        // Regular markdown content processing
        const truncatedContent =
          cleanContent.length > 2000
            ? cleanContent.slice(0, 2000) + '...'
            : cleanContent;

        const embeddedHtml = await renderMarkdown(
          truncatedContent,
          basePath,
          [],
          useWorkspace,
          isRenderRef,
        );

        // Create badges HTML for tags and aliases
        let badgesHtml = '';
        if (tags.length > 0 || aliases.length > 0) {
          badgesHtml = '<div class="embedded-yaml-metadata mb-2">';
          if (aliases.length > 0) {
            badgesHtml +=
              '<div class="aliases-section mb-1"><span class="text-xs font-medium text-muted-foreground mr-1">Aliases:</span>';
            badgesHtml += aliases
              .map(
                (alias) =>
                  `<span class="inline-flex items-center justify-center rounded-md border px-1 py-0.5 text-xs font-medium mr-1 mb-1 bg-secondary text-secondary-foreground">${alias}</span>`,
              )
              .join('');
            badgesHtml += '</div>';
          }
          if (tags.length > 0) {
            badgesHtml +=
              '<div class="tags-section"><span class="text-xs font-medium text-muted-foreground mr-1">Tags:</span>';
            badgesHtml += tags
              .map(
                (tag) =>
                  `<span class="inline-flex items-center justify-center rounded-md border px-1 py-0.5 text-xs font-medium mr-1 mb-1">${tag}</span>`,
              )
              .join('');
            badgesHtml += '</div>';
          }
          badgesHtml += '</div>';
        }

        const wrappedHtml = `
        <div class="embedded-markdown">
          ${badgesHtml}
          ${embeddedHtml}
          ${
            cleanContent.length > 2000
              ? `<div class="embed-more-link"><a href="${basePath}/${encodeURIComponent(actualKey)}" class="embed-more">查看完整内容</a></div>`
              : ''
          }
        </div>
      `;

        contentCache.set(title, wrappedHtml);
        return wrappedHtml;
      } catch (error) {
        console.error('获取嵌入内容失败:', title, error);
        return `<div class="embed-error">加载失败: ${error instanceof Error ? error.message : String(error)}</div>`;
      }
    },
    [
      basePath,
      embedDepth,
      maxEmbedDepth,
      useWorkspace,
      findDocumentKey,
      parseYamlFrontmatter,
    ],
  );

  const fetchAndRenderEmbeddedImage = useCallback(
    async (imagePath: string): Promise<string> => {
      if (embedDepth >= maxEmbedDepth) {
        return `<div class="embed-max-depth">已达到最大嵌入深度 (${maxEmbedDepth})</div>`;
      }

      if (contentCache.has(imagePath)) {
        return contentCache.get(imagePath)!;
      }

      try {
        console.log('=== DEBUG: Frontend Image Fetch ===');
        console.log('Original image path:', imagePath);

        // Special handling for pasted images with exact format
        let cleanImagePath = imagePath.trim();

        // Handle pasted image format: "Pasted image 20241004181916.png"
        if (cleanImagePath.includes('Pasted image')) {
          console.log('Processing pasted image format');

          // Try exact match first
          const exactPaths = [
            cleanImagePath,
            `images/${cleanImagePath}`,
            `attachments/${cleanImagePath}`,
            cleanImagePath.replace(
              /Pasted image (\d{8})(\d{6})\.png/i,
              'Pasted_image_$1_$2.png',
            ),
            cleanImagePath.replace(
              /Pasted image (\d{8})(\d{6})\.png/i,
              'Pasted-image-$1-$2.png',
            ),
            cleanImagePath.replace(/\s+/g, '_'),
            cleanImagePath.replace(/\s+/g, '-'),
          ];

          for (const testPath of [...new Set(exactPaths)]) {
            console.log('Trying image path:', testPath);

            try {
              const response = await fetch(
                `/api/knowledge/image?path=${encodeURIComponent(testPath)}`,
              );
              if (response.ok) {
                const data = await response.json();
                if (data.url) {
                  console.log('✅ Found image at:', testPath);
                  const wrappedHtml = `
                  <div class="embedded-image">
                    <img src="${data.url}" alt="${imagePath}" class="embed-image" style="max-width: 100%; height: auto;" loading="lazy" onerror="this.onerror=null; this.src='/placeholder-image.svg'; console.error('Failed to load image:', '${imagePath}')" />
                  </div>
                `;
                  contentCache.set(imagePath, wrappedHtml);
                  return wrappedHtml;
                }
              } else {
                console.log('❌ Failed for path:', testPath, response.status);
              }
            } catch (err) {
              console.log('❌ Error for path:', testPath, err);
            }
          }

          // If all attempts failed, return detailed error
          return `<div class="embed-error">
          <strong>图片加载失败: ${imagePath}</strong><br>
          已尝试以下路径:<br>
          ${exactPaths.map((p) => `• ${p}`).join('<br>')}
        </div>`;
        }

        // Handle regular image paths
        let cleanPath = cleanImagePath.replace(/^\/+/, '');

        // Handle spaces and special characters
        cleanPath = decodeURIComponent(cleanPath);

        // Add images prefix if needed
        if (!cleanPath.includes('/') && !cleanPath.startsWith('images/')) {
          cleanPath = `images/${cleanPath}`;
        }

        console.log('Final path for API:', cleanPath);

        const response = await fetch(
          `/api/knowledge/image?path=${encodeURIComponent(cleanPath)}`,
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          console.log('API error:', response.status, errorData);

          throw new Error(
            `获取图片URL失败: ${response.status} ${errorData.message || response.statusText}`,
          );
        }

        const data = await response.json();
        console.log('✅ Successfully loaded image:', cleanPath);

        const imageUrl = data.url || '/placeholder-image.svg';

        const wrappedHtml = `
        <div class="embedded-image">
          <img src="${imageUrl}" alt="${imagePath}" class="embed-image" style="max-width: 100%; height: auto;" loading="lazy" onerror="this.onerror=null; this.src='/placeholder-image.svg'; console.error('Failed to load image:', '${imagePath}')" />
        </div>
      `;

        contentCache.set(imagePath, wrappedHtml);
        return wrappedHtml;
      } catch (error) {
        console.error('❌ 获取嵌入图片失败:', imagePath, error);
        return `<div class="embed-error">
        <strong>加载图片失败: ${imagePath}</strong><br>
        错误: ${error instanceof Error ? error.message : String(error)}
      </div>`;
      }
    },
    [embedDepth, maxEmbedDepth],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const katexLink = document.createElement('link');
    katexLink.rel = 'stylesheet';
    katexLink.href =
      'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';

    const highlightLink = document.createElement('link');
    highlightLink.rel = 'stylesheet';
    highlightLink.href =
      'https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.css';

    const calloutsLink = document.createElement('link');
    calloutsLink.rel = 'stylesheet';
    calloutsLink.href =
      'https://cdn.jsdelivr.net/npm/rehype-callouts@2.0.2/dist/themes/obsidian/index.css';

    document.head.appendChild(katexLink);
    document.head.appendChild(highlightLink);
    document.head.appendChild(calloutsLink);

    return () => {
      document.head.removeChild(katexLink);
      document.head.removeChild(highlightLink);
      document.head.removeChild(calloutsLink);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !renderedRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mermaid.run({
            querySelector: '.mermaid',
            nodes: Array.from(mutation.addedNodes).filter(
              (node): node is HTMLElement =>
                node.nodeType === 1 && // ELEMENT_NODE constant value
                (node as HTMLElement).querySelector('.mermaid') !== null,
            ),
          });
        }
      });
    });

    observer.observe(renderedRef.current, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    mermaid.run({
      querySelector: '.mermaid',
      nodes: Array.from(
        renderedRef.current.querySelectorAll('.mermaid'),
      ) as HTMLElement[],
    });

    return () => observer.disconnect();
  }, [html]);

  useEffect(() => {
    if (content.length > 1000000) {
      setError('内容过大，无法渲染');
      return;
    }

    let isMounted = true;
    embedsLoadedRef.current = false;

    const processMarkdown = async () => {
      try {
        setIsProcessing(true);

        // Parse YAML metadata
        const { tags, aliases, cleanContent } = parseYamlFrontmatter(content);
        setYamlData({ tags, aliases });

        let renderedHtml = await renderMarkdown(
          cleanContent,
          basePath,
          references ?? [],
          useWorkspace,
          isRenderRef,
        );

        // Process wiki links to check existence
        renderedHtml = await processWikiLinksWithExistence(renderedHtml);

        if (!isMounted) return;
        setHtml(renderedHtml);
      } catch (err) {
        if (!isMounted) return;
        console.error('Markdown处理错误:', err);
        setError(
          `渲染错误: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    processMarkdown();
    return () => {
      isMounted = false;
    };
  }, [
    content,
    basePath,
    references,
    useWorkspace,
    isRenderRef,
    processWikiLinksWithExistence,
    parseYamlFrontmatter,
  ]);

  useEffect(() => {
    if (!renderedRef.current || !html) return;

    const loadEmbeds = async () => {
      const embeds = renderedRef.current?.querySelectorAll('.embed');
      if (!embeds || embeds.length === 0) return;

      console.log(`Found ${embeds.length} embeds to load`);

      const processedEmbeds = new Set();
      const MAX_CONCURRENT = 3;
      const queue = Array.from(embeds).filter((embed) => {
        const contentEl = embed.querySelector('.embed-content');
        const hasLoading = contentEl?.querySelector('.embed-loading') !== null;
        return hasLoading;
      });

      console.log(`Processing ${queue.length} embeds with loading indicators`);

      const inProgress = new Set();

      const processQueue = async () => {
        while (queue.length > 0 && inProgress.size < MAX_CONCURRENT) {
          const embed = queue.shift() as Element;
          const embedTarget = embed.getAttribute('data-embed-target');
          const embedType = embed.getAttribute('data-embed-type');
          const contentEl = embed.querySelector('.embed-content');

          if (embedTarget && contentEl && !processedEmbeds.has(embedTarget)) {
            processedEmbeds.add(embedTarget);
            inProgress.add(embedTarget);

            try {
              console.log(`Loading ${embedType} embed: ${embedTarget}`);

              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('加载超时')), 15000);
              });

              let renderedContent;
              if (embedType === 'image') {
                renderedContent = await Promise.race([
                  fetchAndRenderEmbeddedImage(embedTarget),
                  timeoutPromise,
                ]);
              } else {
                renderedContent = await Promise.race([
                  fetchAndRenderEmbeddedContent(embedTarget),
                  timeoutPromise,
                ]);
              }

              if (renderedRef.current && contentEl) {
                contentEl.innerHTML = renderedContent as string;

                // Process nested embeds
                const nestedEmbeds = contentEl.querySelectorAll('.embed');
                if (nestedEmbeds.length > 0 && embedDepth < maxEmbedDepth) {
                  nestedEmbeds.forEach((nestedEmbed) => {
                    const nestedTarget =
                      nestedEmbed.getAttribute('data-embed-target');
                    if (nestedTarget && !processedEmbeds.has(nestedTarget)) {
                      queue.push(nestedEmbed);
                    }
                  });
                }

                console.log(
                  `Successfully loaded ${embedType} embed: ${embedTarget}`,
                );
              }
            } catch (error) {
              console.error(
                `Failed to load ${embedType} embed: ${embedTarget}`,
                error,
              );
              if (renderedRef.current && contentEl) {
                contentEl.innerHTML = `<div class="embed-error">加载失败: ${error instanceof Error ? error.message : '未知错误'}</div>`;
              }
            } finally {
              inProgress.delete(embedTarget);
              if (queue.length > 0) {
                setTimeout(() => processQueue(), 100);
              }
            }
          }
        }

        if (queue.length === 0 && inProgress.size === 0) {
          console.log('All embeds loaded');
        }
      };

      // Start processing
      processQueue().catch((error) => {
        console.error('Embed loading error:', error);
      });
    };

    embedsLoadedRef.current = false;
    loadEmbeds();
    return () => {
      embedsLoadedRef.current = false;
    };
  }, [
    html,
    fetchAndRenderEmbeddedContent,
    fetchAndRenderEmbeddedImage,
    embedDepth,
    maxEmbedDepth,
    useWorkspace,
  ]);

  // Remove old hover card related code

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const closestLink = target.closest('a');

      if (closestLink) {
        const href = closestLink.getAttribute('href') || '';
        const exists = closestLink.getAttribute('data-exists') !== 'false';

        // Block clicks on non-existent links
        if (!exists) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Handle workspace links
        if (href.startsWith('workspace:')) {
          e.preventDefault();
          const documentPath = href.replace('workspace:', '');
          if (onOpenDocument) {
            onOpenDocument(decodeURIComponent(documentPath));
          } else {
            // Fallback to router if no workspace handler provided
            router.push(`/wiki/${documentPath}`);
          }
          return;
        }

        // Handle regular wiki links
        if (!href.startsWith('http')) {
          e.preventDefault();
          if (useWorkspace && onOpenDocument) {
            // Convert wiki path to workspace path
            const documentPath = href.replace(basePath + '/', '');
            onOpenDocument(decodeURIComponent(documentPath));
          } else {
            router.push(href);
          }
        }
      }

      const embedTitle = target.closest('.embed-title');
      if (embedTitle) {
        const embed = embedTitle.closest('.embed');
        if (embed) {
          const content = embed.querySelector('.embed-content');
          if (content) content.classList.toggle('collapsed');
        }
      }
    },
    [router, onOpenDocument, useWorkspace, basePath],
  );

  // Remove old hover card related code

  const ReferenceHoverCard: React.FC<{
    refId: string;
    refContent: string;
    referenceNumber: number;
  }> = ({ refId, refContent, referenceNumber }) => {
    const [open, setOpen] = useState(false);

    const handleToggle = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen((prev) => !prev);
    }, []);

    return (
      <HoverCard
        open={open}
        onOpenChange={setOpen}
        openDelay={200}
        closeDelay={200}
      >
        <HoverCardTrigger asChild>
          <button
            className="reference-trigger"
            onClick={handleToggle}
            onMouseDown={(e) => e.preventDefault()} // Prevent text selection on rapid clicks
            aria-label={`Reference ${referenceNumber}`}
          >
            [{referenceNumber}]
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          className="reference-content h-[200px] overflow-y-auto"
          data-reference={refId}
          onPointerDownOutside={(e) => {
            // Only prevent default if the click is outside the trigger itself
            // This allows clicking the trigger to close the card
            if (
              !e.target ||
              !(e.target as HTMLElement).closest('.reference-trigger')
            ) {
              e.preventDefault();
            }
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: refContent }} />
        </HoverCardContent>
      </HoverCard>
    );
  };

  useEffect(() => {
    if (!renderedRef.current || !references) return;

    let roots: ReactDOM.Root[] = []; // Reintroduce roots array

    const renderReferenceComponents = () => {
      // Unmount previous roots before re-rendering
      roots.forEach((root) => root.unmount());
      roots = []; // Reset roots array

      const referencesElements =
        renderedRef.current!.querySelectorAll('.reference');
      referencesElements.forEach((reference) => {
        const refId = reference.getAttribute('data-ref-id');
        if (refId && references[Number(refId)]) {
          const refContent = references[Number(refId)].content;
          const triggerSpan = reference.querySelector('.reference-number');

          if (triggerSpan) {
            const wrapperDiv = document.createElement('span');
            triggerSpan.parentNode?.replaceChild(wrapperDiv, triggerSpan);

            const root = ReactDOM.createRoot(wrapperDiv); // Store the root
            roots.push(root);
            root.render(
              <ReferenceHoverCard
                refId={refId}
                refContent={refContent}
                referenceNumber={Number(refId) + 1}
              />,
            );
          }
        }
      });
    };

    // Initial render of hover cards
    renderReferenceComponents();

    // Set up MutationObserver to re-render hover cards when DOM changes
    const observer = new MutationObserver((mutationsList) => {
      let shouldReRender = false;
      for (const mutation of mutationsList) {
        if (
          mutation.type === 'childList' &&
          mutation.target === renderedRef.current
        ) {
          shouldReRender = true;
          break;
        }
      }

      if (shouldReRender) {
        renderReferenceComponents();
      }
    });

    observer.observe(renderedRef.current, { childList: true, subtree: false });

    return () => {
      observer.disconnect();
      roots.forEach((root) => root.unmount()); // Explicitly unmount all roots
    };
  }, [references]);

  if (error) return <div className="markdown-error text-red-500">{error}</div>;
  // if (isProcessing && !html) return (
  //   <div className="p-6 space-y-4">
  //     <div className="space-y-2">
  //       <Skeleton className="h-8 w-3/4" />
  //       <Skeleton className="h-4 w-1/2" />
  //     </div>

  //     <div className="space-y-3">
  //       <Skeleton className="h-4 w-full" />
  //       <Skeleton className="h-4 w-full" />
  //       <Skeleton className="h-4 w-5/6" />
  //       <Skeleton className="h-4 w-full" />
  //       <Skeleton className="h-4 w-4/6" />
  //       <Skeleton className="h-4 w-full" />
  //       <Skeleton className="h-4 w-3/4" />
  //       <Skeleton className="h-4 w-full" />
  //       <Skeleton className="h-4 w-5/6" />
  //       <Skeleton className="h-4 w-2/3" />
  //     </div>
  //   </div>
  // );

  const containerStyle = fontColor ? { color: fontColor } : undefined;

  return (
    <div
      className={`prose max-w-none ${className || ''}`}
      style={containerStyle}
      data-font-color={fontColor}
    >
      <YamlMetadata tags={yamlData.tags} aliases={yamlData.aliases} />
      <div
        ref={renderedRef}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
