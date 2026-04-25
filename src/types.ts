export enum CaseStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_REFUND = 'PENDING_REFUND',
  REFUNDED = 'REFUNDED'
}

export enum ContactStatus {
  NOT_CONTACTED = 'NOT_CONTACTED',
  CONTACTED = 'CONTACTED',
  NO_RESPONSE = 'NO_RESPONSE'
}

export enum AttemptResult {
  ANSWERED = 'ANSWERED',
  NO_ANSWER = 'NO_ANSWER'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'AGENT';
}
