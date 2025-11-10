// backend/src/types/busboy.d.ts
declare module 'busboy' {
  import { IncomingHttpHeaders } from 'http';
  interface Limits {
    fieldNameSize?: number;
    fieldSize?: number;
    fields?: number;
    fileSize?: number;
    files?: number;
    headerPairs?: number;
  }
  interface BusboyConfig {
    headers: IncomingHttpHeaders | { [key: string]: string | string[] | undefined };
    limits?: Limits;
  }
  interface FileInfo {
    filename: string;
    mimeType: string;
    encoding?: string;
  }
  type FileHandler = (fieldname: string, file: NodeJS.ReadableStream, info: FileInfo) => void;

  class BusboyInstance {
    on(event: 'file', cb: FileHandler): this;
    on(event: 'field', cb: (name: string, value: string, info?: unknown) => void): this;
    on(event: 'finish', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
  }

  function Busboy(config: BusboyConfig): BusboyInstance;
  export = Busboy;
}
