declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface InputOptions {
    buffer: Buffer;
  }

  function extractRawText(options: InputOptions): Promise<ExtractRawTextResult>;

  export default {
    extractRawText,
  };
}
