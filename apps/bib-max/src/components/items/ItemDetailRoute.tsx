import { useEffect, useState } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { itemsApi } from "@/lib/api/items";
import type { Item } from "@/lib/api/types";
import { ItemDetail } from "@/components/ItemDetail";
import type { ItemsContextValue } from "./ItemsLayout";

export function ItemDetailRoute() {
  const { itemId } = useParams<{ itemId: string }>();
  const { items, version } = useOutletContext<ItemsContextValue>();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);

    // Fast path: item is in the current list page
    const found = items.find((i) => i.id === itemId);
    if (found) {
      setItem(found);
      setLoading(false);
      return;
    }

    // Slow path: fetch from API (direct URL / refresh)
    itemsApi
      .getById(itemId)
      .then((data) => setItem(data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [itemId, items, version]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">Item not found.</p>
      </div>
    );
  }

  return <ItemDetail item={item} />;
}
