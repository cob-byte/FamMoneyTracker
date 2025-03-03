// src/types/paluwagan.ts
export interface PaluwaganNumber {
    number: number;
    payoutDate: Date;
    isPaid: boolean;
    isOwner: boolean;
    ownerName?: string;
    accountId?: string;
  }
  
export interface WeeklyPayment {
  weekNumber: number;
  dueDate: Date;
  isPaid: boolean;
  amount: number;
  accountId?: string;
}

export interface Paluwagan {
  id: string;
  name: string;
  amountPerNumber: number;
  startDate: Date;
  totalNumbers: number;
  organizer: string;
  payoutPerNumber: number;
  description?: string;
  numbers: PaluwaganNumber[];
  weeklyPayments: WeeklyPayment[];
  createdAt: Date;
  updatedAt: Date;
}