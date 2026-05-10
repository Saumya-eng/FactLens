export type ClaimStatus = 'verified' | 'inaccurate' | 'false' | 'unknown';

export interface VerificationResult {
  claim: string;
  originalText: string;
  status: ClaimStatus;
  explanation: string;
  confidence: number;
  sources: {
    title: string;
    url: string;
  }[];
}

export interface PipelineStep {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'completed' | 'error';
}
