import { useState, useRef, useCallback } from "react";
import { itemsApi } from "@/lib/api/items";
import { attachmentsApi } from "@/lib/api/attachments";
import type { Tag, ExtractedMetadata, CreateItemInput } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Loader2, ArrowLeft } from "lucide-react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  allTags: Tag[];
  onSaved: () => void;
  onClose: () => void;
}

type Phase = "idle" | "uploading" | "extracting" | "preview" | "saving" | "error";

const emptyForm = {
  type: "article" as "article" | "book",
  title: "",
  authorsStr: "",
  subtitle: "",
  abstract: "",
  year: undefined as number | undefined,
  source: "",
  doi: "",
  isbn: "",
  pmid: "",
  notes: "",
  rating: undefined as number | undefined,
  tagIds: [] as string[],
};

export function PdfUploadTab({ allTags, onSaved, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(emptyForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleTag = (tagId: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((id) => id !== tagId) : [...f.tagIds, tagId],
    }));
  };

  const handleFile = useCallback(async (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file");
      setPhase("error");
      return;
    }

    setFile(selectedFile);
    setPhase("uploading");
    setError("");

    try {
      setPhase("extracting");
      const metadata: ExtractedMetadata = await itemsApi.extractMetadata(selectedFile);
      setForm({
        type: metadata.type || "article",
        title: metadata.title || "",
        authorsStr: metadata.authors?.join(", ") || "",
        subtitle: "",
        abstract: metadata.abstract || "",
        year: metadata.year,
        source: metadata.source || "",
        doi: metadata.doi || "",
        isbn: metadata.isbn || "",
        pmid: metadata.pmid || "",
        notes: "",
        rating: undefined,
        tagIds: [],
      });
      setPhase("preview");
    } catch (err: any) {
      setError(err.message || "Failed to extract metadata");
      setPhase("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleCreate = async () => {
    if (!form.title.trim() || !file) return;
    setPhase("saving");
    setError("");

    try {
      const data: CreateItemInput = {
        type: form.type,
        title: form.title,
        authors: form.authorsStr ? form.authorsStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        subtitle: form.subtitle || undefined,
        abstract: form.abstract || undefined,
        year: form.year,
        source: form.source || undefined,
        doi: form.doi || undefined,
        isbn: form.isbn || undefined,
        pmid: form.pmid || undefined,
        notes: form.notes || undefined,
        rating: form.rating,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      };

      const item = await itemsApi.create(data);

      // Upload the PDF as attachment
      const { attachmentId, url } = await attachmentsApi.getUploadUrl(item.id, file.name, file.type);
      await fetch(url, { method: "PUT", body: file });
      await attachmentsApi.confirmUpload(item.id, {
        attachmentId,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create item");
      setPhase("preview");
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setFile(null);
    setForm(emptyForm);
    setError("");
  };

  // Idle / Error: file picker
  if (phase === "idle" || phase === "error") {
    return (
      <div className="space-y-3">
        <div
          className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50 hover:bg-muted/50"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="size-8 text-muted-foreground" />
          <div className="text-center text-sm text-muted-foreground">
            <p>Drop a PDF here or click to select</p>
            <p className="mt-1 text-xs">Metadata will be extracted automatically</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Uploading / Extracting: loading state
  if (phase === "uploading" || phase === "extracting") {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {phase === "uploading" ? "Uploading PDF..." : "Extracting metadata..."}
        </p>
      </div>
    );
  }

  // Saving
  if (phase === "saving") {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Creating item & uploading attachment...</p>
      </div>
    );
  }

  // Preview: extracted metadata form
  return (
    <div className="min-w-0 space-y-3">
      {/* File indicator */}
      <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded border bg-muted/50 px-2 py-1.5">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs">{file?.name}</span>
        <button onClick={handleReset} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Change file
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="pdf-title">Title *</Label>
            <Input id="pdf-title" value={form.title} onChange={(e) => setField("title", e.target.value)} autoFocus />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pdf-type">Type</Label>
            <Select value={form.type} onValueChange={(v) => setField("type", v as "article" | "book")}>
              <SelectTrigger id="pdf-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="book">Book</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-year">Year</Label>
            <Input
              id="pdf-year"
              type="number"
              value={form.year ?? ""}
              onChange={(e) => setField("year", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className="col-span-2 space-y-1">
            <Label htmlFor="pdf-authors">Authors (comma separated)</Label>
            <Input
              id="pdf-authors"
              value={form.authorsStr}
              onChange={(e) => setField("authorsStr", e.target.value)}
            />
          </div>

          <div className="col-span-2 space-y-1">
            <Label htmlFor="pdf-source">Source</Label>
            <Input id="pdf-source" value={form.source} onChange={(e) => setField("source", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pdf-doi">DOI</Label>
            <Input id="pdf-doi" value={form.doi} onChange={(e) => setField("doi", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-isbn">ISBN</Label>
            <Input id="pdf-isbn" value={form.isbn} onChange={(e) => setField("isbn", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pdf-pmid">PMID</Label>
            <Input id="pdf-pmid" value={form.pmid} onChange={(e) => setField("pmid", e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <Label htmlFor="pdf-abstract">Abstract</Label>
          <Textarea id="pdf-abstract" value={form.abstract} onChange={(e) => setField("abstract", e.target.value)} rows={3} />
        </div>

        <div className="space-y-1">
          <Label>Rating</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setField("rating", form.rating === r ? undefined : r)}
              >
                <Star
                  className={cn(
                    "size-4",
                    form.rating && form.rating >= r ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={form.tagIds.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
            {allTags.length === 0 && <span className="text-xs text-muted-foreground">No tags available</span>}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            <ArrowLeft className="size-3" />
            Back
          </Button>
          <Button type="submit" disabled={!form.title.trim()}>
            Create & Upload
          </Button>
        </div>
      </form>
    </div>
  );
}
