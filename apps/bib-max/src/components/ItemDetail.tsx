import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { attachmentsApi } from "@/lib/api/attachments";
import type { Item, Attachment, AttachmentCategory } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, Upload, X, FileText, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<AttachmentCategory, string> = {
  pdf: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  image: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  video: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  audio: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  markdown: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  document: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  code: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  text: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  archive: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  unknown: "bg-muted text-muted-foreground",
};

const PREVIEWABLE = new Set<AttachmentCategory>(["pdf"]);

interface Props {
  item: Item;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMeta(item: Item): [string, string][] {
  return [
    item.subtitle && ["Subtitle", item.subtitle],
    item.source && ["Source", item.source],
    item.doi && ["DOI", item.doi],
    item.isbn && ["ISBN", item.isbn],
    item.pmid && ["PMID", item.pmid],
    item.url && ["URL", item.url],
    item.rating && ["Rating", `${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}`],
  ].filter(Boolean) as [string, string][];
}

export function ItemDetail({ item }: Props) {
  const navigate = useNavigate();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    attachmentsApi.list(item.id).then((res) => setAttachments(res.data));
  }, [item.id]);

  const handleDownload = async (att: Attachment) => {
    const { url } = await attachmentsApi.getDownloadUrl(item.id, att.id);
    window.open(url, "_blank");
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { attachmentId, url } = await attachmentsApi.getUploadUrl(item.id, file.name, file.type);
      await fetch(url, { method: "PUT", body: file });
      await attachmentsApi.confirmUpload(item.id, {
        attachmentId,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      attachmentsApi.list(item.id).then((res) => setAttachments(res.data));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (!window.confirm(`Delete "${att.fileName}"?`)) return;
    await attachmentsApi.remove(item.id, att.id);
    attachmentsApi.list(item.id).then((res) => setAttachments(res.data));
  };

  const metaFields = getMeta(item);

  return (
    <div className="border-t bg-muted/30 px-3 py-3">
      {item.abstract && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Abstract</div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.abstract}</p>
        </div>
      )}

      {item.notes && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Notes</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}

      {metaFields.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {metaFields.map(([label, value]) => (
            <div key={label} className="text-xs">
              <span className="text-muted-foreground">{label}: </span>
              {label === "URL" ? (
                <a href={value} target="_blank" rel="noreferrer" className="text-primary underline">
                  {value}
                </a>
              ) : (
                <span className="font-medium">{value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator className="my-3" />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Attachments ({attachments.length})
          </span>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="xs" asChild>
              <span>
                <Upload className="size-3" />
                {uploading ? "Uploading..." : "Upload"}
              </span>
            </Button>
          </label>
        </div>

        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments.</p>
        ) : (
          <div className="space-y-1">
            {attachments.map((att) => (
              <div key={att.id} className="flex min-w-0 items-center gap-2 rounded border bg-background px-2 py-1.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                    CATEGORY_STYLES[att.category],
                  )}
                >
                  {att.category}
                </span>
                {PREVIEWABLE.has(att.category) ? (
                  <button
                    onClick={() => navigate(`/items/${item.id}/preview/${att.id}`)}
                    className="min-w-0 flex-1 truncate text-left text-xs hover:text-primary"
                  >
                    {att.fileName}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs">{att.fileName}</span>
                )}
                {att.fileSize != null && (
                  <span className="text-xs text-muted-foreground">{formatSize(att.fileSize)}</span>
                )}
                {PREVIEWABLE.has(att.category) && (
                  <button onClick={() => navigate(`/items/${item.id}/preview/${att.id}`)} className="p-0.5" title="Preview">
                    <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                <button onClick={() => handleDownload(att)} className="p-0.5" title="Download">
                  <Download className="size-3.5 text-muted-foreground hover:text-foreground" />
                </button>
                <button onClick={() => handleDeleteAttachment(att)} className="p-0.5" title="Delete">
                  <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
