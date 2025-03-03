import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Building, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { Account } from '../types/account';

export default function DashboardAccountPreview() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [_totalBalance, setTotalBalance] = useState(0);
  const [_totalAccounts, setTotalAccounts] = useState(0);
  const [currency, setCurrency] = useState('PHP');
  const { currentUser } = useAuth();
  const db = getFirestore();

  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€'
  };

  useEffect(() => {
    async function fetchAccounts() {
      if (!currentUser) return;
      try {        
        // Fetch user currency preference - fixed to use direct doc reference
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }

        // Fetch all accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsQuery = query(accountsCollectionRef);  // Removed ordering to simplify
        const accountsSnapshot = await getDocs(accountsQuery);
        
        if (accountsSnapshot.empty) {
          setAccounts([]);
          setLoading(false);
          return;
        }

        const accountsData = accountsSnapshot.docs.map(doc => {
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
        const totalBalanceCalc = accountsData.reduce((sum, account) => sum + (account.balance || 0), 0);
        setTotalBalance(totalBalanceCalc);
        setTotalAccounts(accountsData.length);

        // Sort by balance (since we removed the orderBy in the query)
        const sortedAccounts = [...accountsData].sort((a, b) => (b.balance || 0) - (a.balance || 0));
        
        // Take only top 3 accounts for preview
        setAccounts(sortedAccounts.slice(0, 3));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [currentUser, db]);

  function formatAmount(amount: number) {
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  }

  function getAccountIcon(accountType: string) {
    switch(accountType) {
      case 'cash': return <DollarSign className="h-5 w-5 text-indigo-600" />;
      case 'bank': return <Building className="h-5 w-5 text-indigo-600" />;
      case 'credit': return <CreditCard className="h-5 w-5 text-indigo-600" />;
      case 'ewallet': return <Smartphone className="h-5 w-5 text-indigo-600" />;
      default: return <Wallet className="h-5 w-5 text-indigo-600" />;
    }
  }

  // First, render the header consistently regardless of loading/empty state
  const header = (
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Your Accounts</h3>
      <Link
        to="/accounts"
        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        View all
      </Link>
    </div>
  );

  // Now handle different content states
  let content;
  
  if (loading) {
    content = (
      <div className="bg-white shadow overflow-hidden sm:rounded-md p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading Account data...</p>
      </div>
    );
  } else if (accounts.length === 0) {
    content = (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="text-center py-8">
          <Wallet className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Accounts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new account.
          </p>
          <div className="mt-6">
            <Link
              to="/add-account"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              New Account
            </Link>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <div key={account.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-indigo-100 rounded-md p-2">
                  {getAccountIcon(account.type)}
                </div>
                <div className="ml-3 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{account.name}</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatAmount(account.balance || 0)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6">
              <div className="text-sm">
                <Link to={`/accounts/${account.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                  View details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Return the component with consistent structure
  return (
    <div className="mb-6">
      {header}
      {content}
    </div>
  );
}