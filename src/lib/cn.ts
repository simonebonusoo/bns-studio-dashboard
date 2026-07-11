import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge di classi Tailwind con dedup. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
