import { Link } from "react-router-dom";
import type { Item } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  items: Item[];
  selectedItemId: string | null;
  onToggleFavorite: (item: Item) => void;
  onDelete: (item: Item) => void;
  onEdit: (item: Item) => void;
  onFilterByTag: (tagId: string) => void;
}

export function ItemsList({ items, selectedItemId, onToggleFavorite, onDelete, onEdit, onFilterByTag }: Props) {
  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No items found.</p>;
  }

  return (
    <div className="space-y-1 p-2">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/items/${item.id}`}
          className={cn(
            "block rounded-md border px-3 py-2 transition-colors hover:bg-accent/50",
            selectedItemId === item.id && "border-primary bg-accent",
          )}
        >
          <div className="flex items-start gap-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite(item);
              }}
              className="mt-0.5 shrink-0"
            >
              <Star
                className={cn(
                  "size-4",
                  item.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                )}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{item.title}</span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {item.type}
                </Badge>
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
                      onClick={(e) => {
                        e.preventDefault();
                        onFilterByTag(tag.id);
                      }}
                      style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(item);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete(item);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
