import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { CreditCard, Clock, PlusCircle, ArrowRight, AlertCircle, Wallet, Building, DollarSign, Smartphone  } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Account } from '../types/account';

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState('PHP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();
  const db = getFirestore();

  // Currency symbols
  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€'
  };

  function getAccountIcon(accountType: string) {
    switch(accountType) {
      case 'cash':
        return <DollarSign className="h-6 w-6 text-indigo-600" />;
      case 'bank':
        return <Building className="h-6 w-6 text-indigo-600" />;
      case 'credit':
        return <CreditCard className="h-6 w-6 text-indigo-600" />;
      case 'ewallet':
        return <Smartphone className="h-6 w-6 text-indigo-600" />;
      default:
        return <Wallet className="h-6 w-6 text-indigo-600" />;
    }
  }

  useEffect(() => {
    async function fetchUserDataAndAccounts() {
      if (!currentUser) return;
      
      try {
        // Get user currency preference
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }
        
        // Fetch accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);
        
        const accountsData = accountsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })) as Account[];
        
        setAccounts(accountsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load account data');
        setLoading(false);
      }
    }
    
    fetchUserDataAndAccounts();
  }, [currentUser, db]);

  function formatAmount(amount: number) {
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  }

  function formatDate(date: Date) {
    if (!date) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  const getAccountTypeName = (type: string) => {
    const types: { [key: string]: string } = {
      cash: 'Cash',
      bank: 'Bank Account',
      credit: 'Credit Card',
      ewallet: 'E-Wallet'
    };
    
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-lg">Loading your accounts...</p>
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
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Accounts</h2>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <Link
                  to="/add-account"
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Account
                </Link>
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
            
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {accounts.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <Link to={`/accounts/${account.id}`} className="block hover:bg-gray-50">
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-2">
                                {getAccountIcon(account.type)}
                              </div>
                              <div className="ml-4">
                                <p className="text-sm font-medium text-indigo-600">{account.name}</p>
                                <p className="text-sm text-gray-500">{getAccountTypeName(account.type)}</p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <p className="px-2 text-sm font-semibold text-gray-900">
                                {formatAmount(account.balance || 0)}
                              </p>
                              <ArrowRight className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                Created {formatDate(account.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
                    <CreditCard className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No accounts yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new account.</p>
                  <div className="mt-6">
                    <Link
                      to="/add-account"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Account
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}