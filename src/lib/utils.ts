import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCaseNumber(countryCode: string, sequence: number) {
  const year = new Date().getFullYear();
  const seq = String(sequence).padStart(4, '0');
  return `REF-${countryCode}-${year}-${seq}`;
}
