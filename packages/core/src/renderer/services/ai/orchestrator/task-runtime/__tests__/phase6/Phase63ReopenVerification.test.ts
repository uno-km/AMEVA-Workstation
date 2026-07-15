import { describe, it, expect } from 'vitest';
import { ReopenVerifier } from '../../workbench/document/ReopenVerifier';
import { MarkdownExtractor, HtmlExtractor, DocxExtractor, PdfExtractor } from '../../workbench/document/Extractors';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';

describe('Phase63ReopenVerification', () => {
  const fakeFs: IFileSystemAdapter = {
    read: async () => 'some text # S1',
    readBytes: async () => new Uint8Array([0, 1, 2, 3]), // invalid docx/pdf
    write: async () => {},
    stat: async () => ({ exists: true, size: 10, isDirectory: false }),
    copy: async () => {},
    move: async () => {},
    hash: async () => 'hash',
    remove: async () => {},
    list: async () => '',
    exists: async () => true,
    realpath: async () => '',
    isSymlink: async () => false
  };

  it('MARKDOWN: should fail if missing required sections', async () => {
    const extractor = new MarkdownExtractor(fakeFs);
    const verifier = new ReopenVerifier(extractor);
    const res = await verifier.verify({ stagedPath: '/dummy.md', artifactFormat: 'MARKDOWN', artifactId: '1', artifactRevision: '1' }, {
      documentId: '1', fullText: 'original full text for similarity', revision: '1', 
      sections: [{ sectionId: '1', title: 'MissingSection', required: true, order: 0, expectedLength: 10, dependencies: [] }]
    } as any);
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('MissingSection'))).toBe(true);
  });

  it('MARKDOWN: should pass on valid text', async () => {
    const validFs: IFileSystemAdapter = { ...fakeFs, read: async () => 'This is a test document. We have a section called intro.\n\n# Intro\n\n100 units.' };
    const extractor = new MarkdownExtractor(validFs);
    const verifier = new ReopenVerifier(extractor);
    const res = await verifier.verify({ stagedPath: '/dummy.md', artifactFormat: 'MARKDOWN', artifactId: '1', artifactRevision: '1' }, {
      documentId: '1', fullText: 'This is a test document. We have a section called intro.\n\n# Intro\n\n100 units.', revision: '1', 
      sections: [{ sectionId: '1', title: 'Intro', required: true, order: 0, expectedLength: 10, dependencies: [] }]
    } as any);
    expect(res.passed).toBe(true);
  });

  it('DOCX: should fail extraction on invalid bytes', async () => {
    const extractor = new DocxExtractor(fakeFs);
    const verifier = new ReopenVerifier(extractor);
    const res = await verifier.verify({ stagedPath: '/dummy.docx', artifactFormat: 'DOCX', artifactId: '1', artifactRevision: '1' }, {
      documentId: '1', fullText: 'Intro', revision: '1', sections: []
    } as any);
    
    expect(res.passed).toBe(false);
    expect(res.errorCode).toBe('DOCX_TEXT_EXTRACTION_FAILED');
  });

  it('PDF: should fail extraction on invalid bytes', async () => {
    const extractor = new PdfExtractor(fakeFs);
    const verifier = new ReopenVerifier(extractor);
    const res = await verifier.verify({ stagedPath: '/dummy.pdf', artifactFormat: 'PDF', artifactId: '1', artifactRevision: '1' }, {
      documentId: '1', fullText: 'Intro', revision: '1', sections: []
    } as any);
    
    expect(res.passed).toBe(false);
    expect(res.errorCode).toBe('PDF_TEXT_EXTRACTION_FAILED');
  });
});
