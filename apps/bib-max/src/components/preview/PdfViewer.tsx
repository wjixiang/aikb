import { useEffect, useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Highlighter, Pencil, MessageSquare, Download } from "lucide-react";
import { PageSlot } from "./PageSlot";

// Worker setup (module level, once)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ============ Annotation types ============

export interface HighlightAnnotation {
  type: "highlight";
  pageIndex: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  color: string;
  text: string;
}

export interface DrawAnnotation {
  type: "draw";
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
}

export interface NoteAnnotation {
  type: "note";
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export type Annotation = HighlightAnnotation | DrawAnnotation | NoteAnnotation;
type ToolType = "none" | "highlight" | "draw" | "note";

// ============ Component ============

interface PdfViewerProps {
  url: string;
  fileName: string;
}

export function PdfViewer({ url, fileName }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("none");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawPageIndex, setDrawPageIndex] = useState<number | null>(null);
  const [drawPoints, setDrawPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [notePosition, setNotePosition] = useState<{ pageIndex: number; x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => {
        if (cancelled) return;
        return pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
      })
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Reset on URL change
  useEffect(() => {
    setAnnotations([]);
    setDrawPoints([]);
    setNotePosition(null);
    setDrawPageIndex(null);
  }, [url]);

  // Measure container width (debounced to avoid scroll reset during layout transitions)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let timerId: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(([entry]) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        setContainerWidth(entry.contentRect.width);
      }, 350);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timerId);
    };
  }, []);

  // Track visible page from scroll position
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const registerPageEl = useCallback((pageIndex: number, el: HTMLDivElement | null) => {
    if (el) pageElementsRef.current.set(pageIndex, el);
    else pageElementsRef.current.delete(pageIndex);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-page-index"));
            if (!isNaN(idx)) setVisiblePage(idx + 1);
          }
        }
      },
      { root: container, rootMargin: "-40% 0px -40% 0px" },
    );

    pageElementsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [totalPages]);

  // Annotation handlers
  const handleAnnotationAdd = useCallback((ann: Annotation) => {
    setAnnotations((prev) => [...prev, ann]);
  }, []);

  const handleDrawPointsChange = useCallback((pageIndex: number, points: Array<{ x: number; y: number }>) => {
    setDrawPageIndex(pageIndex);
    setDrawPoints(points);
  }, []);

  const handleDrawPointsClear = useCallback(() => {
    setDrawPageIndex(null);
    setDrawPoints([]);
  }, []);

  const handleNoteClick = useCallback((pageIndex: number, x: number, y: number) => {
    setNotePosition({ pageIndex, x, y });
    setNoteText("");
  }, []);

  const handleNoteSubmit = useCallback(() => {
    if (!notePosition || !noteText.trim()) {
      setNotePosition(null);
      return;
    }
    setAnnotations((prev) => [
      ...prev,
      {
        type: "note",
        pageIndex: notePosition.pageIndex,
        x: notePosition.x,
        y: notePosition.y,
        text: noteText,
        color: "#3b82f6",
      },
    ]);
    setNotePosition(null);
    setNoteText("");
  }, [notePosition, noteText]);

  const handleNoteCancel = useCallback(() => {
    setNotePosition(null);
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-muted/50 px-2 py-1 overflow-x-auto">
        <span className="min-w-[72px] shrink-0 text-center text-xs text-muted-foreground">
          Page {visiblePage} / {totalPages}
        </span>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
        >
          <ZoomIn className="size-4" />
        </Button>
        <span className="min-w-[40px] shrink-0 text-center text-xs text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
        >
          <ZoomOut className="size-4" />
        </Button>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <Button
          variant={activeTool === "highlight" ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setActiveTool((t) => (t === "highlight" ? "none" : "highlight"))}
          title="Highlight"
        >
          <Highlighter className="size-4" />
        </Button>
        <Button
          variant={activeTool === "draw" ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setActiveTool((t) => (t === "draw" ? "none" : "draw"))}
          title="Draw"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant={activeTool === "note" ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setActiveTool((t) => (t === "note" ? "none" : "note"))}
          title="Note"
        >
          <MessageSquare className="size-4" />
        </Button>

        {annotations.length > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {annotations.length}
          </span>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => window.open(url, "_blank")}
          title="Download"
        >
          <Download className="size-4" />
        </Button>
      </div>

      {/* Scrollable pages */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto bg-gray-100 dark:bg-gray-900"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading PDF...</p>
          </div>
        ) : pdfDoc ? (
          <div className="mx-auto flex flex-col items-center">
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                ref={(el) => registerPageEl(i, el)}
                data-page-index={i}
                className="relative border-b border-gray-200 dark:border-gray-800"
              >
                <PageSlot
                  pageIndex={i}
                  pdfDoc={pdfDoc}
                  scale={scale}
                  annotations={annotations}
                  activeTool={activeTool}
                  onAnnotationAdd={handleAnnotationAdd}
                  drawPoints={drawPageIndex === i ? drawPoints : []}
                  onDrawPointsChange={handleDrawPointsChange}
                  onDrawPointsClear={handleDrawPointsClear}
                  notePosition={notePosition?.pageIndex === i ? { x: notePosition.x, y: notePosition.y } : null}
                  onNoteClick={handleNoteClick}
                  noteText={noteText}
                  onNoteTextChange={setNoteText}
                  onNoteSubmit={handleNoteSubmit}
                  onNoteCancel={handleNoteCancel}
                  containerWidth={containerWidth}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
