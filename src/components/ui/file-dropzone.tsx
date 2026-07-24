"use client";

import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2 } from "lucide-react";

/**
 * Zona de subida de archivos con arrastrar-y-soltar, sin restricción de tipo
 * de archivo. Reutilizada en cualquier punto de la app donde se suban
 * adjuntos (solicitudes, aprobación con PDF, soportes de gestión de pago, etc).
 */
export function FileDropzone({
  onFiles,
  disabled,
  busy,
  multiple = true,
  label = "Adjuntar archivos",
  hint,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  busy?: boolean;
  multiple?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isDisabled = disabled || busy;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDisabled) setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (isDisabled) return;
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isDisabled && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        isDisabled
          ? "cursor-not-allowed border-border bg-muted/30"
          : dragging
            ? "cursor-pointer border-primary bg-primary/5"
            : "cursor-pointer border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        disabled={isDisabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        disabled={isDisabled}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
        {busy ? "Subiendo…" : label}
      </Button>
      <p className="text-xs text-muted-foreground">
        {dragging
          ? "Suelta el/los archivo(s) aquí"
          : (hint ?? `O arrastra y suelta ${multiple ? "los archivos" : "el archivo"} aquí — se admite cualquier tipo de archivo.`)}
      </p>
    </div>
  );
}
