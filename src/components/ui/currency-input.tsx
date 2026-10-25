"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  currencyCaret,
  currencyDecimal,
  currencyDigits,
  currencyDisplay,
} from "@/lib/currency-input";

type Props = {
  id: string;
  name: string;
  required?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  allowZero?: boolean;
  "aria-describedby"?: string;
};

export function CurrencyInput({
  id,
  name,
  required,
  value,
  onValueChange,
  allowZero = false,
  "aria-describedby": describedBy,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entry, setEntry] = useState({ digits: "", digitsToRight: 0 });
  const digits = value === undefined ? entry.digits : currencyDigits(value);
  const display = currencyDisplay(digits);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      const caret = currencyCaret(display, entry.digitsToRight);
      input.setSelectionRange(caret, caret);
    }
  }, [display, entry]);

  function update(value: string, caret: number) {
    const nextDigits = currencyDigits(value);
    setEntry({
      digits: nextDigits,
      digitsToRight: value.slice(caret).replace(/\D/g, "").length,
    });
    onValueChange?.(currencyDecimal(nextDigits));
  }

  return (
    <>
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          required={required}
          pattern={required && !allowZero ? "(?=.*[1-9])[0-9,]+[.][0-9]{2}" : undefined}
          title={
            allowZero
              ? "Los últimos dos dígitos son centavos."
              : "Escribe un monto mayor a cero. Los últimos dos dígitos son centavos."
          }
          aria-describedby={describedBy}
          className="text-right tabular-nums"
          onFocus={(event) => {
            const input = event.currentTarget;
            input.setSelectionRange(input.value.length, input.value.length);
          }}
          onChange={(event) =>
            update(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length,
            )
          }
          onKeyDown={(event) => {
            const input = event.currentTarget;
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? start;
            if (start !== end) return;
            // Delete the adjacent digit even when the caret is beside a separator.
            if (event.key === "Backspace" && start > 0 && /[.,]/.test(display[start - 1])) {
              event.preventDefault();
              let index = start - 1;
              while (index > 0 && /[.,]/.test(display[index])) index--;
              update(display.slice(0, index) + display.slice(start), index);
            } else if (event.key === "Delete" && /[.,]/.test(display[start] ?? "")) {
              event.preventDefault();
              let index = start;
              while (index < display.length && /[.,]/.test(display[index])) index++;
              update(display.slice(0, start) + display.slice(index + 1), start);
            }
          }}
        />
        <InputGroupAddon>
          <InputGroupText aria-hidden="true">$</InputGroupText>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupText aria-hidden="true" className="text-xs">
            MXN
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <input
        type="hidden"
        name={name}
        value={value !== undefined || digits || allowZero ? currencyDecimal(digits) : ""}
      />
    </>
  );
}
