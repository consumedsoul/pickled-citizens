export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export function encodeJson(value: Json | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function decodeJson<T extends Json = Json>(text: string | null | undefined): T | null {
  if (text === null || text === undefined) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
