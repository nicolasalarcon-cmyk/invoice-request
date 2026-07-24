import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asesor } from "@/lib/asesores";

/**
 * Combobox con búsqueda por nombre para elegir Asesor Comercial. La lista
 * llega ya ordenada alfabéticamente (listAsesores ordena por "nombre").
 */
export function AsesorCombobox({
  value,
  onChange,
  options,
  allowNone,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Asesor[];
  allowNone: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{value || "Selecciona el asesor…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
        <Command filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar asesor…" />
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__sin_asignar__"
                  onSelect={() => { onChange(""); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", !value ? "opacity-100" : "opacity-0")} />
                  Sin asignar
                </CommandItem>
              )}
              {options.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.nombre}
                  onSelect={() => { onChange(a.nombre); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value === a.nombre ? "opacity-100" : "opacity-0")} />
                  {a.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
