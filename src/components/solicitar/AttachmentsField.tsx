import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AttachmentItem {
  path: string;
  name: string;
  size: number;
  type: string;
  [key: string]: string | number;
}

const ACCEPT = [
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp",
  ".doc,.docx,.xls,.xlsx,.ppt,.pptx",
  ".zip,.rar,.7z,.tar,.gz,.tar.gz",
  "application/pdf",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
].join(",");

export function AttachmentsField({
  value,
  onChange,
  userId,
  disabled,
}: {
  value: AttachmentItem[];
  onChange: (next: AttachmentItem[]) => void;
  userId: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next: AttachmentItem[] = [...value];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `attachments/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("invoice-files")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        next.push({ path, name: file.name, size: file.size, type: file.type });
      }
      onChange(next);
      toast.success(`${files.length} archivo(s) subido(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir archivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = async (idx: number) => {
    const item = value[idx];
    await supabase.storage.from("invoice-files").remove([item.path]).catch(() => {});
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
        {uploading ? "Subiendo…" : "Adjuntar archivos"}
      </Button>
      <p className="text-xs text-muted-foreground">
        PDF, imágenes, Word, Excel, PowerPoint, archivos comprimidos (ZIP, RAR, 7Z). Puedes subir varios.
      </p>
      {value.length > 0 && (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
          {value.map((f, i) => (
            <li key={f.path} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeAt(i)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
