import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { itemsApi } from "@/lib/api/items";
import type { Item } from "@/lib/api/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Props {
  items: Item[];
}

export function WorkspaceBreadcrumb({ items }: Props) {
  const { itemId } = useParams<{ itemId?: string }>();
  const location = useLocation();
  const isPreview = location.pathname.includes("/preview/");
  const { attId } = useParams<{ attId?: string }>();

  const listItem = items.find((i) => i.id === itemId);
  const [fetchedItem, setFetchedItem] = useState<Item | null>(null);

  useEffect(() => {
    if (itemId && !listItem) {
      setFetchedItem(null);
      itemsApi.getById(itemId).then(setFetchedItem).catch(() => {});
    }
  }, [itemId, listItem]);

  const itemTitle = listItem?.title ?? fetchedItem?.title;

  return (
    <Breadcrumb className="px-4 py-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/items">Workspace</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {itemId && itemTitle && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {isPreview ? (
                <BreadcrumbLink asChild>
                  <Link to={`/items/${itemId}`} className="truncate max-w-md">
                    {itemTitle}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate max-w-md">{itemTitle}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {isPreview && attId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate max-w-64">Preview</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
