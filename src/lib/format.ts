export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
export const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${number(value, 2)}%`;
