// Keep the editable amount as a string of cents to avoid floating-point rounding.
export function currencyDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

export function currencyDecimal(digits: string) {
  const padded = (digits || "0").padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

export function currencyDisplay(digits: string) {
  const [whole, fraction] = currencyDecimal(digits).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

// Restore the caret relative to the digits to its right after adding separators.
export function currencyCaret(display: string, digitsToRight: number) {
  let position = display.length;
  while (position > 0 && digitsToRight > 0) {
    position--;
    if (/\d/.test(display[position])) digitsToRight--;
  }
  return position;
}
