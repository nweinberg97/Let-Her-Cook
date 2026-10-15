export type ImportFileKind = 'image' | 'pdf' | 'docx' | 'text';

export const FILE_LIMITS: Record<ImportFileKind, number> = {
  image: 15 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  docx: 15 * 1024 * 1024,
  text: 2 * 1024 * 1024
};

export const MAX_PDF_TEXT_PAGES = 40;
export const MAX_PDF_OCR_PAGES = 5;

export const ACCEPT_ATTR =
  '.jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.markdown,.docx,image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class FileImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileImportError';
  }
}

const EXT: Record<string, ImportFileKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  pdf: 'pdf',
  docx: 'docx',
  txt: 'text',
  md: 'text',
  markdown: 'text'
};

const MIME_OK: Record<ImportFileKind, RegExp> = {
  image: /^image\/(jpeg|png|webp)$/,
  pdf: /^application\/pdf$/,
  docx: /^application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|zip|octet-stream)$/,
  text: /^(text\/(plain|markdown|x-markdown)|application\/octet-stream)$/
};

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / 1024 / 1024)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function sniff(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 16).arrayBuffer());
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

/**
 * Checks extension, declared type, size AND the file's first bytes, so a
 * renamed file can't slip a different format past the importer.
 */
export async function validateImportFile(file: File): Promise<ImportFileKind> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'heic' || ext === 'heif' || /heic|heif/i.test(file.type)) {
    throw new FileImportError('HEIC photos (the iPhone default) can’t be read here yet. Take a screenshot of the photo, or export it as JPG, and try again.');
  }
  if (ext === 'doc' || ext === 'pages' || ext === 'rtf' || ext === 'odt') {
    throw new FileImportError(`.${ext} files aren’t supported. Save the document as .docx or PDF, or copy the text and paste it instead.`);
  }
  const kind = EXT[ext];
  if (!kind) {
    throw new FileImportError(
      `“${file.name}” isn’t a supported file. You can import photos and screenshots (JPG, PNG, WebP), PDFs, Word documents (.docx) and text files (.txt, .md).`
    );
  }
  if (file.type && !MIME_OK[kind].test(file.type)) {
    throw new FileImportError(`“${file.name}” says it’s a .${ext} file but its contents don’t match. Try exporting it again.`);
  }
  if (file.size === 0) throw new FileImportError(`“${file.name}” is empty.`);
  if (file.size > FILE_LIMITS[kind]) {
    throw new FileImportError(`“${file.name}” is ${formatSize(file.size)}. The limit for this kind of file is ${formatSize(FILE_LIMITS[kind])}.`);
  }
  const head = await sniff(file);
  const ok =
    kind === 'pdf'
      ? startsWith(head, [0x25, 0x50, 0x44, 0x46]) // %PDF
      : kind === 'docx'
        ? startsWith(head, [0x50, 0x4b, 0x03, 0x04]) // ZIP
        : kind === 'image'
          ? startsWith(head, [0xff, 0xd8, 0xff]) || startsWith(head, [0x89, 0x50, 0x4e, 0x47]) || (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8))
          : !head.includes(0); // text: no NUL bytes
  if (!ok) {
    throw new FileImportError(`“${file.name}” looks damaged or isn’t really a .${ext} file. Your existing recipes are safe. Try exporting the file again.`);
  }
  return kind;
}
