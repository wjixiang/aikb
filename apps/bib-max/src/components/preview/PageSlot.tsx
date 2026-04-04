import { useEffect, useRef, useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import type { Annotation } from "./PdfViewer";
import { cn } from "@/lib/utils";

interface PageSlotProps {
  pageIndex: number;
  pdfDoc: PDFDocumentProxy;
  scale: number;
  annotations: Annotation[];
  activeTool: string;
  onAnnotationAdd: (ann: Annotation) => void;
  drawPoints: Array<{ x: number; y: number }>;
  onDrawPointsChange: (pageIndex: number, points: Array<{ x: number; y: number }>) => void;
  onDrawPointsClear: () => void;
  notePosition: { x: number; y: number } | null;
  onNoteClick: (pageIndex: number, x: number, y: number) => void;
  noteText: string;
  onNoteTextChange: (text: string) => void;
  onNoteSubmit: () => void;
  onNoteCancel: () => void;
  containerWidth: number;
}

export function PageSlot({
  pageIndex,
  pdfDoc,
  scale,
  annotations,
  activeTool,
  onAnnotationAdd,
  drawPoints,
  onDrawPointsChange,
  onDrawPointsClear,
  notePosition,
  onNoteClick,
  noteText,
  onNoteTextChange,
  onNoteSubmit,
  onNoteCancel,
  containerWidth,
}: PageSlotProps) {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const slotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel(): void } | null>(null);
  const textLayerInstance = useRef<TextLayer | null>(null);

  // Compute page dimensions
  useEffect(() => {
    let cancelled = false;
    pdfDoc.getPage(pageIndex + 1).then((page) => {
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / baseViewport.width;
      const renderScale = fitScale * scale;
      const viewport = page.getViewport({ scale: renderScale });
      setWidth(viewport.width);
      setHeight(viewport.height);
    });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, scale, containerWidth]);

  // IntersectionObserver
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { rootMargin: "500px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render canvas + text layer when visible
  useEffect(() => {
    if (!visible || !canvasRef.current || containerWidth === 0) return;
    let cancelled = false;

    async function render() {
      const page = await pdfDoc.getPage(pageIndex + 1);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / baseViewport.width;
      const renderScale = fitScale * scale;
      const viewport = page.getViewport({ scale: renderScale });

      // Canvas
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d")!;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        return;
      }

      // Text layer
      if (!cancelled && textLayerRef.current) {
        // TextLayer's setLayerDimensions uses var(--total-scale-factor) for sizing
        // We must set it to viewport.scale so calc() resolves correctly
        textLayerRef.current.style.setProperty("--total-scale-factor", String(viewport.scale));
        textLayerRef.current.style.setProperty("--scale-round-x", "1px");
        textLayerRef.current.style.setProperty("--scale-round-y", "1px");
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const tl = new TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport,
        });
        textLayerInstance.current = tl;
        try {
          await tl.render();
        } catch {
          return;
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textLayerInstance.current?.cancel();
      textLayerInstance.current = null;
      if (textLayerRef.current) textLayerRef.current.innerHTML = "";
    };
  }, [pdfDoc, pageIndex, scale, visible, containerWidth]);

  // Cleanup canvas when leaving viewport
  useEffect(() => {
    if (visible || !canvasRef.current) return;
    canvasRef.current.width = 0;
    canvasRef.current.height = 0;
  }, [visible]);

  // Highlight: listen for text selection
  useEffect(() => {
    if (activeTool !== "highlight" || !visible) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !slotRef.current) return;

      const range = selection.getRangeAt(0);
      const slotEl = slotRef.current;
      if (!slotEl.contains(range.commonAncestorContainer)) return;

      const slotRect = slotEl.getBoundingClientRect();
      const rects = Array.from(range.getClientRects());
      if (rects.length === 0) return;

      onAnnotationAdd({
        type: "highlight",
        pageIndex,
        rects: rects.map((r) => ({
          x: r.left - slotRect.left,
          y: r.top - slotRect.top,
          width: r.width,
          height: r.height,
        })),
        color: "rgba(255, 235, 59, 0.4)",
        text: selection.toString(),
      });
      selection.removeAllRanges();
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [activeTool, pageIndex, visible, onAnnotationAdd]);

  // Draw: pointer events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeTool !== "draw" || !slotRef.current) return;
      const rect = slotRef.current.getBoundingClientRect();
      onDrawPointsChange(pageIndex, [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [activeTool, pageIndex, onDrawPointsChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeTool !== "draw" || drawPoints.length === 0 || !slotRef.current) return;
      const rect = slotRef.current.getBoundingClientRect();
      onDrawPointsChange(pageIndex, [...drawPoints, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    },
    [activeTool, drawPoints, pageIndex, onDrawPointsChange],
  );

  const handlePointerUp = useCallback(() => {
    if (activeTool !== "draw" || drawPoints.length < 2) {
      onDrawPointsClear();
      return;
    }
    onAnnotationAdd({
      type: "draw",
      pageIndex,
      points: [...drawPoints],
      color: "#ef4444",
      strokeWidth: 2,
    });
    onDrawPointsClear();
  }, [activeTool, drawPoints, pageIndex, onAnnotationAdd, onDrawPointsClear]);

  // Note: click on SVG
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (activeTool !== "note" || !slotRef.current) return;
      const rect = slotRef.current.getBoundingClientRect();
      onNoteClick(pageIndex, e.clientX - rect.left, e.clientY - rect.top);
    },
    [activeTool, pageIndex, onNoteClick],
  );

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);
  const isDrawing = drawPoints.length > 0 && drawPoints[0] !== undefined;

  return (
    <div
      ref={slotRef}
      className="relative inline-block"
      style={{ width, height: height || undefined }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: '100%', height: '100%' }}
      />
      <div
        ref={textLayerRef}
        className="textLayer"
      />
      <svg
        className={cn(
          "absolute top-0 left-0",
          activeTool === "draw" && "cursor-crosshair",
          activeTool === "note" && "cursor-crosshair",
          activeTool === "highlight" && "cursor-text",
        )}
        style={{ width, height: height || undefined, pointerEvents: visible && activeTool !== "none" ? "auto" : "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleSvgClick}
      >
        {pageAnnotations.map((ann, i) => {
          if (ann.type === "highlight") {
            return ann.rects.map((rect, j) => (
              <rect key={`h-${i}-${j}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={ann.color} />
            ));
          }
          if (ann.type === "draw") {
            const d = ann.points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            return (
              <path key={`d-${i}`} d={d} fill="none" stroke={ann.color} strokeWidth={ann.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            );
          }
          if (ann.type === "note") {
            return (
              <g key={`n-${i}`}>
                <circle cx={ann.x} cy={ann.y} r={8} fill={ann.color} />
                <text x={ann.x + 14} y={ann.y + 4} fontSize="12" fill={ann.color} style={{ pointerEvents: "none" }}>
                  {ann.text.length > 40 ? ann.text.slice(0, 40) + "..." : ann.text}
                </text>
              </g>
            );
          }
          return null;
        })}

        {isDrawing && drawPoints.length > 1 && (
          <path
            d={drawPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {notePosition && notePosition !== undefined && (
        <div className="absolute z-10" style={{ left: notePosition.x, top: notePosition.y - 8 }}>
          <input
            autoFocus
            value={noteText}
            onChange={(e) => onNoteTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNoteSubmit();
              if (e.key === "Escape") onNoteCancel();
            }}
            onBlur={onNoteSubmit}
            placeholder="Add note..."
            className="w-56 rounded border bg-background px-2 py-1 text-xs shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
