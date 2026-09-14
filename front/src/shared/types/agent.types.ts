export type GroupBatchStatus = 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface GroupBatch {
  id: string;
  code: string;
  name: string;
  destination: string;
  duration?: string;
  projectReason?: string;
  travelDate?: string;
  status: GroupBatchStatus;
  totalAmount?: number;
  commission?: number;
  dossiersCount?: number;
  dossiers?: any[];
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'COMMISSION' | 'PAYOUT' | 'REFUND';
  amount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
}

export interface AgentWallet {
  id: string;
  balance: number;
  currency: string;
  transactions?: WalletTransaction[];
}

export interface PayoutRequest {
  id: string;
  amount: number;
  bankName: string;
  iban: string;
  swiftBic?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED';
  createdAt: string;
}
