import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Solo la primera letra en mayúscula (el estilo CSS `capitalize` pondría también "De" y "Oct")
export const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
