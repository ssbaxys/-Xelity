/// <reference types="vite/client" />

declare const __XELITY_BUILD_ID__: string;
declare const __XELITY_CLIENT__: string;

declare module '@babel/standalone' {
  export function transform(
    code: string,
    options?: Record<string, unknown>,
  ): { code?: string | null };
}
