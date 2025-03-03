export interface Debt {
    id: string;
    type: 'owe' | 'owed';
    name: string;
    counterpartyName: string;
    totalAmount: number;
    paymentSchedule: PaymentSchedule[];
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface PaymentSchedule {
    dueDate: Date;
    amount: number;
    isPaid: boolean;
    accountId?: string;
  }