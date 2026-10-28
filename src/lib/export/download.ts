import { isNativeApp, saveFileNative } from '../native';

/**
 * Saves a file to the user's device. In the iPhone app this opens the share
 * sheet ("Save to Files", AirDrop, Mail…); on the web it downloads.
 */
export async function downloadFile(content: string, fileName: string, type = 'application/json'): Promise<void> {
  if (isNativeApp) return saveFileNative(content, fileName);
  downloadInBrowser(content, fileName, type);
}

function downloadInBrowser(content: string | Blob, fileName: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'recipe'
  );
}
