import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
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
import { Plus, ArrowUp, ArrowDown, PanelLeftClose, PanelLeftOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ItemDialog } from "@/components/ItemDialog";
import { ItemsList } from "./ItemsList";
import { WorkspaceBreadcrumb } from "./WorkspaceBreadcrumb";

export interface ItemsContextValue {
  items: Item[];
  allTags: Tag[];
  version: number;
  loading: boolean;
}

export function ItemsLayout() {
  const { itemId } = useParams<{ itemId?: string }>();
  const navigate = useNavigate();
  const selectedItemId = itemId ?? null;

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
  const [listCollapsed, setListCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // Reset collapse when navigating away from a selected item
  useEffect(() => {
    if (!selectedItemId) setListCollapsed(false);
  }, [selectedItemId]);

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
  }, [query, version]);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setQuery((q) => ({ ...q, search: value || undefined, page: 1 }));
    }, 300);
  }, []);

  const SORT_FIELDS: SortField[] = ["createdAt", "updatedAt", "year", "title"];

  const cycleSort = () => {
    setQuery((q) => {
      const current = q.sortBy ?? "createdAt";
      const idx = SORT_FIELDS.indexOf(current);
      const next = SORT_FIELDS[(idx + 1) % SORT_FIELDS.length];
      return {
        ...q,
        sortBy: next,
        sortOrder: q.sortBy === next && q.sortOrder === "desc" ? "asc" : "desc",
      };
    });
  };

  const toggleFavorite = async (item: Item) => {
    await itemsApi.update(item.id, { isFavorite: !item.isFavorite });
    setVersion((v) => v + 1);
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await itemsApi.remove(item.id);
    if (selectedItemId === item.id) {
      navigate("/items");
    }
    setVersion((v) => v + 1);
  };

  const filterByTag = (tagId: string) => {
    setQuery((q) => ({
      ...q,
      tagIds: q.tagIds?.[0] === tagId ? undefined : [tagId],
      page: 1,
    }));
  };

  const outletContext: ItemsContextValue = { items, allTags, version, loading };

  return (
    <div className="flex h-full flex-col">
      <WorkspaceBreadcrumb items={items} />

      <div className="flex min-h-0 flex-1">
        {/* Mobile: show detail full-width with back button, or list full-width */}
        {isMobile && selectedItemId ? (
          <div className="min-w-0 flex-1 flex flex-col overflow-auto">
            <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
              <Button variant="ghost" size="icon-sm" onClick={() => navigate("/items")} title="Back to list">
                <ArrowLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium truncate">Back to list</span>
            </div>
            <div className="min-w-0 flex-1 overflow-auto">
              <Outlet context={outletContext} />
            </div>
          </div>
        ) : (
        <>
        <div
          className={cn(
            "flex shrink-0 flex-col overflow-hidden transition-[width] duration-200",
            selectedItemId && !listCollapsed ? "w-[360px] border-r" : "",
            selectedItemId && listCollapsed ? "w-10 border-r" : "",
            !selectedItemId && "flex-1",
          )}
        >
          {selectedItemId && (
            <div className="flex items-center justify-end border-b px-1 py-1">
              <Button variant="ghost" size="icon-xs" onClick={() => setListCollapsed(!listCollapsed)} title="Toggle list">
                {listCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
              </Button>
            </div>
          )}
          {!listCollapsed && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <Input
                  placeholder="Search..."
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-7 w-full text-xs"
                />
                <Select
                  value={query.type ?? "all"}
                  onValueChange={(v) =>
                    setQuery((q) => ({
                      ...q,
                      type: v === "all" ? undefined : (v as "article" | "book"),
                      page: 1,
                    }))
                  }
                >
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon-xs" onClick={cycleSort} title="Sort">
                  {query.sortOrder === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : (
                    <ArrowDown className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setEditingItem(null);
                    setDialogOpen(true);
                  }}
                  title="New Item"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {query.tagIds && (
                <div className="border-b px-3 py-1">
                  <Badge
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => filterByTag(query.tagIds![0])}
                  >
                    Filtered by tag
                    <span className="ml-1 text-muted-foreground">x</span>
                  </Badge>
                </div>
              )}
              <div className="flex items-center border-b px-3 py-1">
                <span className="text-xs text-muted-foreground">{total} items</span>
              </div>
            </>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading...</p>
            ) : listCollapsed ? (
              <div className="flex flex-col items-center gap-1 py-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/items/${item.id}`)}
                    title={item.title}
                    className={cn(
                      "flex w-7 items-center justify-center rounded text-xs hover:bg-accent",
                      selectedItemId === item.id && "bg-accent font-medium",
                    )}
                  >
                    {item.authors[0]?.[0] ?? item.title[0]}
                  </button>
                ))}
              </div>
            ) : (
              <ItemsList
                items={items}
                selectedItemId={selectedItemId}
                onToggleFavorite={toggleFavorite}
                onDelete={handleDelete}
                onEdit={(item) => {
                  setEditingItem(item);
                  setDialogOpen(true);
                }}
                onFilterByTag={filterByTag}
              />
            )}
          </div>
          {totalPages > 1 && !listCollapsed && (
            <div className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={query.page! <= 1}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <span>
                {query.page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={query.page! >= totalPages}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        {selectedItemId && (
          <div className="min-w-0 flex-1 overflow-auto">
            <Outlet context={outletContext} />
          </div>
        )}
        </>
        )}
      </div>

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
