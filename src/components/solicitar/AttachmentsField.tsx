import { useRef, useState, type DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export interface AttachmentItem {
  path: string;
  name: string;
  size: number;
  type: string;
  [key: string]: string | number;
}

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
  const [dragging, setDragging] = useState(false);

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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !uploading) setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          disabled || uploading
            ? "cursor-not-allowed border-border bg-muted/30"
            : dragging
              ? "cursor-pointer border-primary bg-primary/5"
              : "cursor-pointer border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <Button
          type="button"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          disabled={disabled || uploading}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
          {uploading ? "Subiendo…" : "Adjuntar archivos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {dragging ? "Suelta los archivos aquí" : "O arrastra y suelta los archivos aquí — se admite cualquier tipo de archivo. Puedes subir varios."}
        </p>
      </div>
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

/**
 * Lista de solo lectura para los adjuntos de la solicitud rechazada original:
 * quedan como soporte/trazabilidad y no se pueden eliminar al corregir.
 */
export function HistoricalAttachmentsList({ items }: { items: AttachmentItem[] }) {
  if (items.length === 0) return null;

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("invoice-files").createSignedUrl(path, 60);
    if (error || !data) return toast.error("No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3 w-3" /> Archivos de la solicitud rechazada original (no se pueden eliminar)
      </p>
      <ul className="divide-y divide-border rounded-md border border-border bg-muted/30">
        {items.map((f) => (
          <li key={f.path} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => openFile(f.path)}
              className="flex min-w-0 items-center gap-2 text-left hover:underline"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(f.size / 1024).toFixed(0)} KB
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
