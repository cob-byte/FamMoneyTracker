import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { AlertCircle, Plus } from 'lucide-react';
import { toast } from 'react-toastify';

export default function AccountSetup() {
  const [currency, setCurrency] = useState('PHP');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('cash');
  const [initialBalance, setInitialBalance] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  
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
  
  // Check if user has completed setup
  useEffect(() => {
    async function checkUserSetup() {
      if (!currentUser) return;
      
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().setupComplete) {
          // User has already completed setup, redirect to dashboard
          navigate('/dashboard');
        }
        
        setIsCheckingSetup(false);
      } catch (error) {
        console.error('Error checking user setup:', error);
        setIsCheckingSetup(false);
      }
    }
    
    checkUserSetup();
  }, [currentUser, db, navigate]);

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
      
      // Create user document with preferences
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        email: currentUser.email,
        currency,
        setupComplete: true,
        createdAt: new Date()
      }, { merge: true });
      
      // Create first account
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
      
      toast.success('Account setup complete!');
      navigate('/dashboard');
    } catch (error) {
      setError('Failed to setup account');
      toast.error('Failed to setup account');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
        <div className="text-center">
          <div className="flex justify-center">
            <Plus className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Account Setup</h2>
          <p className="mt-2 text-sm text-gray-600">
            Set up your preferences and create your first account
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {currencies.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>
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
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  className="block w-full pl-10 pr-20 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => setInitialBalance((prev) => Math.max(0, parseFloat(prev || '0') - 1).toFixed(2))}
                    className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setInitialBalance((prev) => (parseFloat(prev || '0') + 1).toFixed(2))}
                    className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}