// Minimal type shims for environment without node_modules

declare module 'fastify';
declare module '@fastify/cors';
declare module '@fastify/helmet';
declare module '@fastify/rate-limit';
declare module 'drizzle-orm';
declare module 'drizzle-orm/postgres-js';
declare module 'postgres';
declare module 'zod';
declare module 'dotenv';
declare module 'mailgun.js';
declare module 'form-data';
declare module 'fast-xml-parser';

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
  argv: string[];
  exit(code?: number): void;
};

declare module 'crypto' {
  export function createHmac(
    algorithm: string,
    key: string | NodeJS.ArrayBufferView
  ): {
    update(data: string): any;
    digest(encoding: string): string;
  };
  export function createHash(algorithm: string): any;
}

declare module 'fs' {
  export function readFileSync(
    path: string,
    encoding?: string
  ): string;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
}
