import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { AlertCircle, PlusCircle, MinusCircle, Clock } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Account, Transaction } from '../types/account';
import DashboardPaluwaganPreview from '../components/DashboardPaluwaganPreview';
import DashboardDebtPreview from '../components/DashboardDebtPreview';
import DashboardAccountPreview from '../components/DashboardAccountPreview';

export default function Dashboard() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [_accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [currency, setCurrency] = useState('PHP');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€'
  };

  useEffect(() => {
    async function checkSetupAndFetchData() {
      if (!currentUser) return;
  
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
  
        if (!userDoc.exists() || !userDoc.data().setupComplete) {
          navigate('/account-setup');
          return;
        }
  
        if (userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }
  
        // Fetch all accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsQuery = query(accountsCollectionRef);
        const accountsSnapshot = await getDocs(accountsQuery);
  
        const allAccounts = accountsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            type: data.type,
            balance: data.balance || 0,
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
          } as Account;
        });
  
        // Calculate total balance and total accounts
        const totalBalanceCalc = allAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
        setTotalBalance(totalBalanceCalc);
        setTotalAccounts(allAccounts.length);
  
        // Sort by balance descending and take the first 3
        const sortedPreview = allAccounts
          .sort((a, b) => (b.balance || 0) - (a.balance || 0))
          .slice(0, 3);
        setAccounts(sortedPreview);
  
        // Fetch transactions (unchanged, but updated mapping for consistency)
        const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
        const transactionsQuery = query(
          transactionsCollectionRef,
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
  
        const transactionsData = transactionsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            description: data.description,
            amount: data.amount,
            type: data.type,
            category: data.category,
            date: data.date ? data.date.toDate() : new Date(),
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            accountId: data.accountId
          } as Transaction;
        });
  
        setTransactions(transactionsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    }
  
    checkSetupAndFetchData();
  }, [currentUser, db, navigate]);

  function formatAmount(amount: number, type?: string) {
    const symbol = currencySymbols[currency] || currency;
    return `${type === 'expense' ? '-' : ''}${symbol}${amount.toFixed(2)}`;
  }

  function formatDate(date: Date) {
    if (!date) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function getTransactionIcon(type: string) {
    if (type === 'income') {
      return <PlusCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <MinusCircle className="h-5 w-5 text-red-500" />;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-lg">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar/>
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Dashboard</h2>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
            
            {/* Balance overview */}
            <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <div className="text-sm font-medium text-gray-500">Total Balance</div>
                <div className="mt-1 text-3xl font-semibold text-gray-900">
                  {formatAmount(totalBalance)}
                </div>
                <div className="mt-1 text-sm text-gray-500">Across {totalAccounts} accounts</div>
              </div>
            </div>
            
            {/* Accounts section */}
            <DashboardAccountPreview />
            
            {/* Paluwagan Section */}
            <DashboardPaluwaganPreview />

            {/* Debt Section */}
            <DashboardDebtPreview />

            {/* Recent transactions section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Transactions</h3>
                <Link to="/transactions" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  View all
                </Link>
              </div>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <li key={transaction.id}>
                        <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{transaction.description}</div>
                              <div className="flex text-sm text-gray-500 items-center">
                                <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                <span>{formatDate(transaction.date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                            {formatAmount(transaction.amount, transaction.type)}
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
                      No recent transactions
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}