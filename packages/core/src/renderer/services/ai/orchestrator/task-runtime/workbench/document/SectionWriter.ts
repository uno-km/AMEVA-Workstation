import { DocumentContract, DocumentOutline, DocumentSection } from '../domain/WorkbenchTypes';

export interface SectionWriterContext {
  contract: DocumentContract;
  outline: DocumentOutline;
  targetSectionId: string;
  previousSections: DocumentSection[];
}

export interface SectionWriterResult {
  section: DocumentSection;
  usedTokens: number;
}

export class SectionWriter {
  public prepareContext(context: SectionWriterContext): string {
    const targetSection = context.outline.sections.find(s => s.sectionId === context.targetSectionId);
    if (!targetSection) {
      throw new Error(`Section ${context.targetSectionId} not found in outline`);
    }

    let prompt = `You are an expert document writer.\n`;
    prompt += `Objective: ${context.contract.objective}\n`;
    prompt += `Audience: ${context.contract.audience}\n`;
    prompt += `Style: ${context.contract.style}\n\n`;

    prompt += `Outline:\n`;
    context.outline.sections.forEach(s => {
      prompt += `- ${s.title} ${s.sectionId === context.targetSectionId ? '(TARGET)' : ''}\n`;
    });

    if (context.previousSections.length > 0) {
      prompt += `\nPrevious Sections Summaries:\n`;
      context.previousSections.forEach(s => {
        const summary = s.content ? s.content.substring(0, 100) + '...' : 'No content';
        prompt += `- ${s.title}: ${summary}\n`;
      });
    }

    prompt += `\nPlease write the content for section: ${targetSection.title}\n`;
    prompt += `Expected length: ${targetSection.expectedLength} characters.\n`;
    prompt += `Do NOT use placeholders like TODO, TBD, or Lorem Ipsum.\n`;

    return prompt;
  }

  public writeSection(context: SectionWriterContext, llmGeneratedContent: string): SectionWriterResult {
    const targetSection = context.outline.sections.find(s => s.sectionId === context.targetSectionId);
    if (!targetSection) {
      throw new Error(`Section ${context.targetSectionId} not found in outline`);
    }

    const updatedSection: DocumentSection = {
      ...targetSection,
      content: llmGeneratedContent,
      status: 'WRITTEN',
      revision: '1'
    };

    return {
      section: updatedSection,
      usedTokens: llmGeneratedContent.length
    };
  }
}
