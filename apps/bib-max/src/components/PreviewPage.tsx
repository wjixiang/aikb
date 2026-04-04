import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { attachmentsApi } from "@/lib/api/attachments";
import type { Attachment } from "@/lib/api/types";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PdfViewer } from "./preview/PdfViewer";
import { PreviewFallback } from "./preview/PreviewFallback";

export function PreviewPage() {
  const { itemId, attId } = useParams<{ itemId: string; attId: string }>();
  const navigate = useNavigate();
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId || !attId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    attachmentsApi
      .list(itemId)
      .then((res) => {
        if (cancelled) return;
        const att = res.data.find((a) => a.id === attId);
        if (!att) throw new Error("Attachment not found");
        setAttachment(att);
        return attachmentsApi.getDownloadUrl(itemId, att.id);
      })
      .then(({ url }) => {
        if (cancelled) return;
        setUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, attId]);

  const renderViewer = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      );
    }
    if (!url || !attachment) return null;

    if (attachment.category === "pdf") {
      return <PdfViewer url={url} fileName={attachment.fileName} />;
    }
    return <PreviewFallback />;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-4 py-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => navigate("/items")}>Items</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate max-w-64">
                {attachment?.fileName ?? "Preview"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="min-h-0 flex-1">{renderViewer()}</div>
    </div>
  );
}
