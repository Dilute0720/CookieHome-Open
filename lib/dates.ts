export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function tomorrow() {
  const date = startOfLocalDay(new Date());
  date.setDate(date.getDate() + 1);
  return date;
}

export function defaultTodoMenuDate() {
  return tomorrow();
}

export function parseDateInputValue(value: FormDataEntryValue | string | null | undefined) {
  const dateText = String(value ?? "").trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

export function formatDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodoMenuDate(value: FormDataEntryValue | string | null | undefined) {
  return parseDateInputValue(value) ?? defaultTodoMenuDate();
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}
