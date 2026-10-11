"use client";

import { useEffect, useState } from "react";
import { Store, type LucideIcon } from "lucide-react";
import { getExpenseVendors } from "@/app/expenses/vendor-actions";
import { vendorCache } from "@/lib/vendor-cache";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";

export function VendorCombobox({ id }: { id: string }) {
  return <RememberedNameCombobox id={id} name="vendor" placeholder="Selecciona o escribe un proveedor" icon={Store} cache={vendorCache} fetchOptions={getExpenseVendors} />;
}

export function RememberedNameCombobox({ id, name, placeholder, icon: Icon, cache, fetchOptions, maxLength }: {
  id: string;
  name: string;
  placeholder: string;
  icon: LucideIcon;
  cache: typeof vendorCache;
  fetchOptions: () => Promise<string[]>;
  maxLength?: number;
}) {
  const [vendors, setVendors] = useState<string[]>([]);
  const [text, setText] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setVendors(cache.read());
      void cache.refresh(fetchOptions).then((values) => { if (active) setVendors(values); });
    });
    return () => { active = false; };
  }, [cache, fetchOptions]);
  const custom = text.trim();
  const isNew = custom && !vendors.some((vendor) => vendor.toLocaleLowerCase("es") === custom.toLocaleLowerCase("es"));
  const items = isNew ? [...vendors, custom] : vendors;

  return <>
    <input type="hidden" name={name} value={text.trim()} />
    <Combobox<string> items={items} value={text || null} inputValue={text} onInputValueChange={(value, details) => {
      if (details.reason === "input-change" || details.reason === "clear-press" || details.reason === "item-press") setText(value);
      else details.cancel();
    }} onValueChange={(value) => { if (value !== null) setText(value); }}>
      <ComboboxInput id={id} placeholder={placeholder} maxLength={maxLength}>
        <InputGroupAddon><Icon aria-hidden="true" /></InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxList>
          {(vendor: string) => <ComboboxItem key={vendor} value={vendor}>{isNew && vendor === custom ? `Usar “${vendor}”` : vendor}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </>;
}
