// Minimal typings for the 'cookie' package to satisfy TS in ESM projects.
declare module 'cookie' {
  export interface CookieSerializeOptions {
    path?: string;
    expires?: Date;
    maxAge?: number;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: true | false | 'lax' | 'strict' | 'none';
  }

  export interface CookieParseOptions {
    decode?(value: string): string;
  }

  export function serialize(
    name: string,
    val: string,
    options?: CookieSerializeOptions
  ): string;

  export function parse(
    str: string,
    options?: CookieParseOptions
  ): Record<string, string>;
}
