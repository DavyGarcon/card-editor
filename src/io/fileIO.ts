import { slugify } from './formats';

/** Reads a user-selected file as text, with a clear error for unreadable files. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.readAsText(file);
  });
}

/** Triggers a browser download of a JSON string. */
export function downloadJsonFile(filename: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function jsonFileName(name: string, kind: 'template' | 'deck'): string {
  return `${slugify(name)}-${kind}.json`;
}
