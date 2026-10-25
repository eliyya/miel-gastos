"use client";

import { UserRound } from "lucide-react";
import { getSaleCustomers } from "@/app/sales/customer-actions";
import { customerCache } from "@/lib/customer-cache";
import { RememberedNameCombobox } from "@/components/vendor-combobox";

export function CustomerCombobox({ id }: { id: string }) {
  return (
    <RememberedNameCombobox
      id={id}
      name="customer"
      placeholder="Selecciona o escribe un cliente"
      icon={UserRound}
      cache={customerCache}
      fetchOptions={getSaleCustomers}
      maxLength={160}
    />
  );
}
