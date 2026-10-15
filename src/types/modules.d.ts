declare module 'mammoth/mammoth.browser' {
  interface Result {
    value: string;
    messages: { type: string; message: string }[];
  }
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
