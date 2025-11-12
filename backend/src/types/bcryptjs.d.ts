declare module 'bcryptjs' {
  export function genSaltSync(rounds?: number): string;
  export function hashSync(data: string, salt: string): string;
  export function compareSync(data: string, encrypted: string): boolean;

  export function genSalt(rounds?: number): Promise<string>;
  export function hash(data: string, salt: string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
