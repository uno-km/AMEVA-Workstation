import { randomUUID } from 'crypto';
import { DocumentContract } from '../domain/WorkbenchTypes';

export interface CreateContractRequest {
  documentType: string;
  objective: string;
  audience?: string;
  language?: string;
  style?: string;
  requiredSections?: string[];
  optionalSections?: string[];
  acceptanceCriteria?: string[];
  complianceRules?: string[];
  minimumLength?: number;
  maximumLength?: number;
  requiredTables?: number;
  requiredFigures?: number;
  requiredArtifacts?: string[];
}

export class DocumentContractService {
  public createContract(request: CreateContractRequest): DocumentContract {
    return {
      contractId: randomUUID(),
      documentType: request.documentType,
      objective: request.objective,
      audience: request.audience || 'General',
      language: request.language || 'English',
      style: request.style || 'Standard',
      requiredSections: request.requiredSections || [],
      optionalSections: request.optionalSections || [],
      acceptanceCriteria: request.acceptanceCriteria || [],
      complianceRules: request.complianceRules || [],
      minimumLength: request.minimumLength || 1000,
      maximumLength: request.maximumLength || 100000,
      requiredTables: request.requiredTables || 0,
      requiredFigures: request.requiredFigures || 0,
      requiredArtifacts: request.requiredArtifacts || []
    };
  }

  public validateContract(contract: DocumentContract): boolean {
    if (!contract.documentType || contract.documentType.trim() === '') {
      return false;
    }
    if (!contract.objective || contract.objective.trim() === '') {
      return false;
    }
    if (contract.minimumLength > contract.maximumLength) {
      return false;
    }
    return true;
  }
}
