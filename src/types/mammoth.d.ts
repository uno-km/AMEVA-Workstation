
declare module 'mammoth' {
  export function convertToMarkdown(input: any): Promise<{ value: string; messages: any[] }>;
  export function extractRawText(input: any): Promise<{ value: string; messages: any[] }>;
  export function convertToHtml(input: any): Promise<{ value: string; messages: any[] }>;
}
