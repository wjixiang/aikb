import { useEffect, useState } from "react";
import { tagsApi } from "@/lib/api/tags";
import type { Tag, CreateTagInput, UpdateTagInput } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [form, setForm] = useState<CreateTagInput>({ name: "", color: "#6366f1", description: "" });
  const [saving, setSaving] = useState(false);

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    setLoading(true);
    tagsApi
      .list({ page, pageSize, search, withCount: true })
      .then((res) => {
        setTags(res.data);
        setTotal(res.pagination.total);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, version]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", color: "#6366f1", description: "" });
    setOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setForm({ name: tag.name, color: tag.color ?? "#6366f1", description: tag.description ?? "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const data: UpdateTagInput = {};
        if (form.name !== editing.name) data.name = form.name;
        if (form.color !== (editing.color ?? "#6366f1")) data.color = form.color;
        if (form.description !== (editing.description ?? "")) data.description = form.description;
        await tagsApi.update(editing.id, data);
      } else {
        await tagsApi.create(form);
      }
      setOpen(false);
      setVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    await tagsApi.remove(tag.id);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" />
          New Tag
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags found.</p>
      ) : (
        <div className="space-y-1">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color ?? "#6366f1" }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{tag.name}</div>
                {tag.description && (
                  <div className="truncate text-xs text-muted-foreground">{tag.description}</div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{tag.itemCount ?? 0} items</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(tag)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => handleDelete(tag)}>
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tag" : "New Tag"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="size-8 cursor-pointer rounded border"
                />
                <Input
                  id="tag-color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="max-w-[120px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-desc">Description</Label>
              <Textarea
                id="tag-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
