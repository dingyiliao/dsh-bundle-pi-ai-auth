import type { Context } from '@deepseek-ai/cordis';
export declare function httpUrl(raw: string | undefined): string | undefined;
/** Open one provider-owned authorization URL with the operating system browser. */
export declare function openBrowser(ctx: Context, url: string): void;
