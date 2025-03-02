import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { AlertCircle, PlusCircle, MinusCircle, CreditCard, Clock, Users } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Account, Transaction } from '../types/account';
import { Paluwagan } from '../types/paluwagan'

export default function Dashboard() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paluwagans, setPaluwagans] = useState<Paluwagan[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [currency, setCurrency] = useState('PHP');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  // Currency symbols
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
          // User hasn't completed setup, redirect to setup page
          navigate('/account-setup');
          return;
        }
        
        // Set user currency preference
        if (userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }
        
        // Fetch accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsQuery = query(accountsCollectionRef);
        const accountsSnapshot = await getDocs(accountsQuery);
        
        const accountsData = accountsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Account));
        
        setAccounts(accountsData);
        
        // Calculate total balance across all accounts
        const total = accountsData.reduce((sum, account) => sum + (account.balance || 0), 0);
        setTotalBalance(total);
        
        // Fetch recent transactions
        const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
        const transactionsQuery = query(
          transactionsCollectionRef,
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        const transactionsData = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() // Convert Firestore timestamp to JS Date
        } as Transaction));
        
        setTransactions(transactionsData);
        
        // Fetch paluwagans
        const paluwagansCollectionRef = collection(db, 'users', currentUser.uid, 'paluwagans');
        const paluwagansQuery = query(paluwagansCollectionRef);
        const paluwagansSnapshot = await getDocs(paluwagansQuery);
        
        const paluwagansData = paluwagansSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            startDate: data.startDate?.toDate(),
            amountPerNumber: data.amountPerNumber,
            payoutPerNumber: data.payoutPerNumber,
            numbers: data.numbers?.map((num: any) => ({
              ...num,
              payoutDate: num.payoutDate?.toDate()
            })),
            weeklyPayments: data.weeklyPayments?.map((payment: any) => ({
              ...payment,
              dueDate: payment.dueDate?.toDate()
            }))
          } as Paluwagan;
        });
        
        setPaluwagans(paluwagansData);
        
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
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  // Determine transaction icon
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
                <div className="mt-1 text-sm text-gray-500">Across {accounts.length} accounts</div>
              </div>
            </div>
            
            {/* Accounts section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Your Accounts</h3>
                <Link
                  to="/add-account"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  + Add Account
                </Link>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                  <div key={account.id} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                          <CreditCard className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{account.name}</dt>
                            <dd>
                              <div className="text-lg font-medium text-gray-900">{formatAmount(account.balance || 0)}</div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-4 sm:px-6">
                      <div className="text-sm">
                        <Link to={`/accounts/${account.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          View details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Paluwagan Section */}
            {paluwagans.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Your Paluwagan</h3>
                  <Link
                    to="/paluwagan"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View all
                  </Link>
                </div>
                
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {paluwagans.slice(0, 3).map((paluwagan) => {
                      const userNumbers = paluwagan.numbers.filter(num => num.isOwner);
                      const nextPayout = userNumbers
                        .filter(num => !num.isPaid && num.payoutDate > new Date())
                        .sort((a, b) => a.payoutDate.getTime() - b.payoutDate.getTime())[0];
                      
                      return (
                        <li key={paluwagan.id}>
                          <Link to={`/paluwagan/${paluwagan.id}`} className="block hover:bg-gray-50">
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-indigo-600 truncate">
                                  {paluwagan.name}
                                </div>
                                <div className="ml-2 flex-shrink-0 flex">
                                  <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {formatAmount(paluwagan.payoutPerNumber)}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex justify-between">
                                <div className="flex items-center text-sm text-gray-500">
                                  <Users className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                                  {userNumbers.length} number{userNumbers.length !== 1 ? 's' : ''} 
                                </div>
                                {nextPayout && (
                                  <div className="flex items-center text-sm text-indigo-600">
                                    <Clock className="flex-shrink-0 mr-1.5 h-5 w-5 text-indigo-500" />
                                    Next payout: {formatDate(nextPayout.payoutDate)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                    
                    {paluwagans.length === 0 && (
                      <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
                        No Paluwagan yet
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Debt Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Debt Management</h3>
                <Link
                  to="/debt"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View all
                </Link>
              </div>
              
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
                    Coming Soon - Track your debts and loans
                  </li>
                </ul>
              </div>
            </div>

            {/* Recent transactions section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Transactions</h3>
                <Link
                  to="/transactions"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
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
                              <div className="flex text-sm text-gray-500">
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