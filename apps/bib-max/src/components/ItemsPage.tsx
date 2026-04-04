import { useCallback, useEffect, useRef, useState } from "react";
import { itemsApi } from "@/lib/api/items";
import { tagsApi } from "@/lib/api/tags";
import type { Item, ItemQuery, Tag, SortField } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ItemDialog } from "./ItemDialog";
import { ItemDetail } from "./ItemDetail";
import { Plus, MoreHorizontal, Pencil, Trash2, Star, BookOpenCheck, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const [query, setQuery] = useState<ItemQuery>({ page: 1, pageSize: 20 });
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    tagsApi.list({ pageSize: 100, withCount: true }).then((res) => setAllTags(res.data));
  }, [version]);

  useEffect(() => {
    setLoading(true);
    itemsApi
      .list(query)
      .then((res) => {
        setItems(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotal(res.pagination.total);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, version]);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setQuery((q) => ({ ...q, search: value || undefined, page: 1 }));
    }, 300);
  }, []);

  const setSort = (field: SortField) => {
    setQuery((q) => ({
      ...q,
      sortBy: field,
      sortOrder: q.sortBy === field && q.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  const toggleFavorite = async (item: Item) => {
    await itemsApi.update(item.id, { isFavorite: !item.isFavorite });
    setVersion((v) => v + 1);
  };

  const toggleRead = async (item: Item) => {
    await itemsApi.update(item.id, { isRead: !item.isRead });
    setVersion((v) => v + 1);
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await itemsApi.remove(item.id);
    setVersion((v) => v + 1);
  };

  const filterByTag = (tagId: string) => {
    setQuery((q) => ({
      ...q,
      tagIds: q.tagIds?.[0] === tagId ? undefined : [tagId],
      page: 1,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-64"
        />
        <Select
          value={query.type ?? "all"}
          onValueChange={(v) => setQuery((q) => ({ ...q, type: v === "all" ? undefined : (v as "article" | "book"), page: 1 }))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="article">Article</SelectItem>
            <SelectItem value="book">Book</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setSort("updatedAt")} className="text-xs">
          Sort: {query.sortBy ?? "createdAt"} {query.sortOrder === "asc" ? "^" : "v"}
        </Button>
        <Button
          onClick={() => {
            setEditingItem(null);
            setDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4" />
          New Item
        </Button>
        {query.tagIds && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => filterByTag(query.tagIds![0])}>
            Filtered by tag
            <span className="ml-1 text-muted-foreground">x</span>
          </Badge>
        )}
      </div>

      <div className="text-xs text-muted-foreground">{total} items</div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items found.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <div key={item.id} className="rounded-md border">
                <div className="flex items-start gap-3 px-3 py-2">
                  <button onClick={() => toggleFavorite(item)} className="mt-0.5 shrink-0">
                    <Star className={cn("size-4", item.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                  </button>
                  <button onClick={() => setExpandedId(expanded ? null : item.id)} className="mt-0.5 shrink-0">
                    {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">{item.type}</Badge>
                    </div>
                    {item.authors.length > 0 && (
                      <div className="truncate text-xs text-muted-foreground">
                        {item.authors.join(", ")}
                        {item.year ? ` (${item.year})` : ""}
                      </div>
                    )}
                    {item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="cursor-pointer text-xs"
                            onClick={() => filterByTag(tag.id)}
                            style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => toggleRead(item)} className="p-1">
                      {item.isRead ? <BookOpenCheck className="size-4 text-muted-foreground" /> : <BookOpen className="size-4 text-muted-foreground" />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(item)}>
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {expanded && <ItemDetail item={item} />}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" disabled={query.page! <= 1} onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}>
            Previous
          </Button>
          <span>Page {query.page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={query.page! >= totalPages} onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}>
            Next
          </Button>
        </div>
      )}

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        allTags={allTags}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}
