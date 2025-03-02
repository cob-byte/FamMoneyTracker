import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { AlertCircle, CreditCard, Menu, X, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';

export default function AddAccount() {
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('cash');
  const [initialBalance, setInitialBalance] = useState('0');
  const [currency, setCurrency] = useState('PHP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();
  
  // Currency options
  const currencies = [
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ];

  // Get current currency symbol
  const getCurrentCurrencySymbol = () => {
    const selectedCurrency = currencies.find(c => c.code === currency);
    return selectedCurrency ? selectedCurrency.symbol : '₱';
  };
  
  // Account type options
  const accountTypes = [
    { id: 'cash', name: 'Cash' },
    { id: 'bank', name: 'Bank Account' },
    { id: 'credit', name: 'Credit Card' },
    { id: 'ewallet', name: 'E-Wallet' },
  ];
  
  // Fetch user's currency preference
  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;
      
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
    
    fetchUserData();
  }, [currentUser, db]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!accountName.trim()) {
      setError('Account name is required');
      toast.error('Account name is required');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Create account
      const accountsCollectionRef = doc(db, 'users', currentUser.uid, 'accounts', Date.now().toString());
      await setDoc(accountsCollectionRef, {
        name: accountName,
        type: accountType,
        balance: parseFloat(initialBalance) || 0,
        createdAt: new Date()
      });
      
      // If there's an initial balance, create a transaction
      if (parseFloat(initialBalance) > 0) {
        const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
        await setDoc(transactionDocRef, {
          type: 'income',
          amount: parseFloat(initialBalance),
          description: 'Initial balance',
          category: 'Initial',
          accountId: accountsCollectionRef.id,
          accountName: accountName,
          date: new Date(),
          createdAt: new Date()
        });
      }
      
      toast.success('Account created successfully!');
      navigate('/accounts');
    } catch (error) {
      setError('Failed to create account');
      toast.error('Failed to create account');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar/>
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <Link
                    to="/accounts"
                    className="inline-flex items-center mr-3 text-indigo-600 hover:text-indigo-800"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Add Account</h2>
                </div>
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
            
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="account-name" className="block text-sm font-medium text-gray-700">
                    Account Name
                  </label>
                  <input
                    id="account-name"
                    name="account-name"
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g., Wallet, BDO Savings, GCash"
                  />
                </div>
                
                <div>
                  <label htmlFor="account-type" className="block text-sm font-medium text-gray-700">
                    Account Type
                  </label>
                  <select
                    id="account-type"
                    name="account-type"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {accountTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="initial-balance" className="block text-sm font-medium text-gray-700">
                    Initial Balance
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">{getCurrentCurrencySymbol()}</span>
                    </div>
                    <input
                      id="initial-balance"
                      name="initial-balance"
                      type="number"
                      step="0.01"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-3 sm:text-sm border-gray-300 rounded-md"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Link
                    to="/accounts"
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="cursor-pointer inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}