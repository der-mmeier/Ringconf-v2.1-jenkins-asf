export interface TextInsertionSelection {
  start: number;
  end: number;
}

export interface TextInsertionResult {
  value: string;
  cursor: number;
}

export function countCodePoints(value: string): number {
  return Array.from(value ?? "").length;
}

export function clampToCodePoints(value: string, maxLength: number): string {
  const limit = Math.max(0, Math.floor(maxLength));
  return Array.from(value ?? "").slice(0, limit).join("");
}

export function insertTextAtSelection(
  value: string,
  insertValue: string,
  selection: TextInsertionSelection,
  maxLength: number
): TextInsertionResult {
  const source = String(value ?? "");
  const insert = String(insertValue ?? "");
  const start = clampSelectionIndex(selection.start, source.length);
  const end = clampSelectionIndex(selection.end, source.length);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const next = source.slice(0, from) + insert + source.slice(to);
  const clamped = clampToCodePoints(next, maxLength);
  const desiredCursor = from + insert.length;
  return {
    value: clamped,
    cursor: Math.min(desiredCursor, clamped.length),
  };
}

function clampSelectionIndex(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.floor(value)));
}
