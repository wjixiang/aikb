import { useEffect, useState } from "react";
import { itemsApi } from "@/lib/api/items";
import type { Item, Tag, CreateItemInput } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PdfUploadTab } from "./PdfUploadTab";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  allTags: Tag[];
  onSaved: () => void;
}

const emptyForm: Omit<CreateItemInput, "tagIds"> & { authorsStr: string; tagIds: string[] } = {
  type: "article",
  title: "",
  authorsStr: "",
  subtitle: "",
  abstract: "",
  year: undefined,
  source: "",
  doi: "",
  isbn: "",
  pmid: "",
  url: "",
  notes: "",
  isFavorite: false,
  rating: undefined,
  tagIds: [],
};

export function ItemDialog({ open, onOpenChange, item, allTags, onSaved }: Props) {
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditMode = !!item;

  useEffect(() => {
    if (open && item) {
      setForm({
        type: item.type,
        title: item.title,
        authorsStr: item.authors.join(", "),
        subtitle: item.subtitle ?? "",
        abstract: item.abstract ?? "",
        year: item.year ?? undefined,
        source: item.source ?? "",
        doi: item.doi ?? "",
        isbn: item.isbn ?? "",
        pmid: item.pmid ?? "",
        url: item.url ?? "",
        notes: item.notes ?? "",
        isFavorite: item.isFavorite,
        rating: item.rating ?? undefined,
        tagIds: item.tags.map((t) => t.id),
      });
    } else if (open) {
      setForm(emptyForm);
    }
    setError("");
  }, [open, item]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleTag = (tagId: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((id) => id !== tagId) : [...f.tagIds, tagId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data: CreateItemInput = {
        type: form.type,
        title: form.title,
        authors: form.authorsStr
          ? form.authorsStr.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        subtitle: form.subtitle || undefined,
        abstract: form.abstract || undefined,
        year: form.year ? Number(form.year) : undefined,
        source: form.source || undefined,
        doi: form.doi || undefined,
        isbn: form.isbn || undefined,
        pmid: form.pmid || undefined,
        url: form.url || undefined,
        notes: form.notes || undefined,
        isFavorite: form.isFavorite,
        rating: form.rating,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      };

      if (item) {
        await itemsApi.update(item.id, data);
      } else {
        await itemsApi.create(data);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={form.title} onChange={(e) => setField("title", e.target.value)} autoFocus />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={form.type} onValueChange={(v) => setField("type", v as "article" | "book")}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="book">Book</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input id="year" type="number" value={form.year ?? ""} onChange={(e) => setField("year", e.target.value ? Number(e.target.value) : undefined)} />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="authors">Authors (comma separated)</Label>
          <Input id="authors" value={form.authorsStr} onChange={(e) => setField("authorsStr", e.target.value)} placeholder="Author 1, Author 2, ..." />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input id="subtitle" value={form.subtitle} onChange={(e) => setField("subtitle", e.target.value)} />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="source">Source</Label>
          <Input id="source" value={form.source} onChange={(e) => setField("source", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doi">DOI</Label>
          <Input id="doi" value={form.doi} onChange={(e) => setField("doi", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isbn">ISBN</Label>
          <Input id="isbn" value={form.isbn} onChange={(e) => setField("isbn", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pmid">PMID</Label>
          <Input id="pmid" value={form.pmid} onChange={(e) => setField("pmid", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" value={form.url} onChange={(e) => setField("url", e.target.value)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="abstract">Abstract</Label>
        <Textarea id="abstract" value={form.abstract} onChange={(e) => setField("abstract", e.target.value)} rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button key={r} type="button" onClick={() => setField("rating", form.rating === r ? undefined : r)}>
              <Star className={cn("size-5", form.rating && form.rating >= r ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
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

      <Separator />

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.isFavorite} onCheckedChange={(v) => setField("isFavorite", v)} />
          Favorite
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={saving || !form.title.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-xl flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{item ? "Edit Item" : "New Item"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 pb-6 min-w-0">
            {isEditMode ? (
              formContent
            ) : (
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
                  <TabsTrigger value="pdf" className="flex-1">PDF Upload</TabsTrigger>
                </TabsList>
                <TabsContent value="manual">{formContent}</TabsContent>
                <TabsContent value="pdf">
                  <PdfUploadTab allTags={allTags} onSaved={onSaved} onClose={() => onOpenChange(false)} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
