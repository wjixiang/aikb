import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { attachmentsApi } from "@/lib/api/attachments";
import type { Attachment } from "@/lib/api/types";
import { PdfViewer } from "@/components/preview/PdfViewer";
import { MarkdownViewer } from "@/components/preview/MarkdownViewer";
import { PreviewFallback } from "@/components/preview/PreviewFallback";

export function PreviewRoute() {
  const { itemId, attId } = useParams<{ itemId: string; attId: string }>();
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

  if (attachment.category === "markdown") {
    return <MarkdownViewer url={url} fileName={attachment.fileName} />;
  }

  return <PreviewFallback />;
}
