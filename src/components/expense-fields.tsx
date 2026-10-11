"use client";

import { useId } from "react";
import { CalendarDays, CreditCard, FileText, Tags } from "lucide-react";
import { VendorCombobox } from "@/components/vendor-combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categories = [
  "Insumos", "Envases", "Etiquetas", "Transporte", "Produccion",
  "Ventas", "Servicios", "Renta", "General",
];

export function ExpenseFields({ today }: { today: string }) {
  const id = useId();
  return <>
    <div className="grid grid-cols-2 gap-4">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-amount`}>Monto *</Label>
        <CurrencyInput id={`${id}-amount`} name="amount" required />
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-spentAt`}>Fecha *</Label>
        <InputGroup>
          <InputGroupInput id={`${id}-spentAt`} name="spentAt" type="date" defaultValue={today} required />
          <InputGroupAddon><CalendarDays aria-hidden="true" /></InputGroupAddon>
        </InputGroup>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-category`}>Categoría</Label>
        <Select name="category" defaultValue="Insumos">
          <SelectTrigger id={`${id}-category`} size="field"><Tags aria-hidden="true" className="text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}><SelectGroup>
            {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${id}-paymentMethod`}>Método de pago *</Label>
        <Select name="paymentMethod" defaultValue="Efectivo" required>
          <SelectTrigger id={`${id}-paymentMethod`} size="field"><CreditCard aria-hidden="true" className="text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}><SelectGroup>
            {["Efectivo", "Débito", "Crédito", "Transferencia"].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor={`${id}-vendor`}>Proveedor</Label>
      <VendorCombobox id={`${id}-vendor`} />
    </div>
    <div className="grid gap-2">
      <Label htmlFor={`${id}-description`}>Descripción *</Label>
      <InputGroup>
        <InputGroupTextarea id={`${id}-description`} name="description" placeholder="Frascos de vidrio, gasolina para entrega..." required />
        <InputGroupAddon className="self-start pt-2.5"><FileText aria-hidden="true" /></InputGroupAddon>
      </InputGroup>
    </div>
  </>;
}
