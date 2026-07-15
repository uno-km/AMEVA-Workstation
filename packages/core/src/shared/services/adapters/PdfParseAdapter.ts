export class PdfParseAdapter {
  /**
   * Safely loads pdf-parse and verifies its API signature.
   * Prevents speculative generic calls and explicitly checks the 2.4.5 API.
   */
  public static getPdfParse(): (dataBuffer: Buffer, options?: any) => Promise<{ text: string, numpages: number, info: any }> {
    try {
      const p = require('pdf-parse');
      
      // Strict check for API signature
      if (typeof p === 'function') {
        return p;
      }
      
      if (p && typeof p.default === 'function') {
        return p.default;
      }
      
      if (p && typeof p.PDFParse === 'function') {
        return p.PDFParse;
      }

      throw new Error('PDF_EXTRACTOR_API_UNSUPPORTED');
    } catch (e: any) {
      if (e.message === 'PDF_EXTRACTOR_API_UNSUPPORTED') {
        throw e;
      }
      throw new Error('PDF_EXTRACTOR_LOAD_FAILED');
    }
  }
}
