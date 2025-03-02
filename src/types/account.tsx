  export interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
    createdAt: Date;
  }
  
  export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: Date;
    createdAt: Date;
    accountId: string;
  }