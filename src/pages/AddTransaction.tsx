import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Account } from '../types/account';

export default function AddTransaction() {
  // Extract query parameters from URL
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlAccountId = queryParams.get('accountId');

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState(urlAccountId || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState('PHP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  
  // Currency symbols
  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€'
  };

  // Expense categories
  const expenseCategories = [
    'Food', 'Transport', 'Utilities', 'Rent', 'Entertainment', 
    'Shopping', 'Health', 'Education', 'Subscriptions', 'Other'
  ];

  // Income categories
  const incomeCategories = [
    'Salary', 'Bonus', 'Refund', 'Gift', 'Interest', 'Investment', 'Other'
  ];

  

  useEffect(() => {
    async function fetchUserDataAndAccounts() {
      if (!currentUser) return;
      
      try {
        // Get user currency preference - using getDoc for a single document instead of getDocs for all users
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userDocRef);
        
        if (userSnapshot.exists() && userSnapshot.data().currency) {
          setCurrency(userSnapshot.data().currency);
        }
        
        // Fetch accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);
        
        if (accountsSnapshot.empty) {
          setError('No accounts found. Please create an account first.');
          return;
        }
        
        const accountsData = accountsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Account[];
        
        setAccounts(accountsData);
        
        // If no account is selected yet, set the first one as default
        // But if we have a URL accountId and it exists in our accounts, use that
        if (!accountId) {
          if (urlAccountId && accountsData.some(account => account.id === urlAccountId)) {
            setAccountId(urlAccountId);
          } else {
            setAccountId(accountsData[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load account data');
      }
    }
    
    fetchUserDataAndAccounts();
  }, [currentUser, db, urlAccountId, accountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Description is required');
      toast.error('Description is required');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!accountId) {
      setError('Please select an account');
      toast.error('Please select an account');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const selectedAccount = accounts.find(account => account.id === accountId);
      if (!selectedAccount) {
        throw new Error('Selected account not found');
      }
      
      const amountValue = parseFloat(amount);

      if (type === 'expense' && amountValue > selectedAccount.balance) {
        setError(`Insufficient funds in ${selectedAccount.name}. Available balance: ${currencySymbols[currency] || currency}${selectedAccount.balance.toFixed(2)}`);
        toast.error('Insufficient funds');
        setLoading(false);
        return;
      }
      
      const dateTimeObj = new Date(date);
      const [hours, minutes] = time.split(':').map(Number);
      dateTimeObj.setHours(hours, minutes, 0, 0);
        
      // Create transaction document
      const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
      await setDoc(transactionDocRef, {
        type,
        amount: amountValue,
        description,
        category,
        accountId,
        accountName: selectedAccount.name,
        date: dateTimeObj,
        createdAt: new Date()
      });
      
      // Update account balance
      const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
      const newBalance = type === 'income' 
        ? selectedAccount.balance + amountValue
        : selectedAccount.balance - amountValue;
      
      await updateDoc(accountDocRef, {
        balance: newBalance
      });
      
      toast.success('Transaction added successfully!');
      navigate(-1);
    } catch (error) {
      setError('Failed to add transaction');
      toast.error('Failed to add transaction');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="mb-6 flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">
                Add Transaction
              </h1>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
              {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <p className="ml-3 text-red-700">{error}</p>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Transaction Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type
                  </label>
                  <div className="flex w-full rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`w-1/2 py-2 text-sm font-medium rounded-l-md border border-gray-300 focus:outline-none ${
                        type === 'expense'
                          ? 'bg-red-100 text-red-700 border-red-500'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`w-1/2 py-2 text-sm font-medium rounded-r-md border border-gray-300 focus:outline-none ${
                        type === 'income'
                          ? 'bg-green-100 text-green-700 border-green-500'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Income
                    </button>
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Amount Input */}
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                        Amount
                      </label>
                      <div className="relative mt-1 rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">
                            {currencySymbols[currency] || currency}
                          </span>
                        </div>
                        <input
                          type="number"
                          id="amount"
                          step="1"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="block w-full pl-10 pr-20 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="0.00"
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setAmount((prev) => {
                              const current = parseFloat(prev || '0');
                              if (current < 1) {
                                return prev;
                              }
                              return (current - 1).toFixed(2);
                            });
                          }}
                          className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                        >
                          -
                        </button>
                          <button
                            type="button"
                            onClick={() => setAmount((prev) => (parseFloat(prev || '0') + 1).toFixed(2))}
                            className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                          >
                            +
                        </button>
                        </div>
                      </div>
                    </div>

                    {/* Description Input */}
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <input
                        type="text"
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="What was this transaction for?"
                        required
                      />
                    </div>

                    {/* Category Select */}
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Select a category</option>
                        {(type === 'expense' ? expenseCategories : incomeCategories).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Account Select */}
                    <div>
                      <label htmlFor="accountId" className="block text-sm font-medium text-gray-700">
                        Account
                      </label>
                      <select
                        id="accountId"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Select an account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({currencySymbols[currency] || currency}{account.balance?.toFixed(2) || '0.00'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Input */}
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        Date
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* Time Input */}
                    <div>
                      <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                        Time
                      </label>
                      <input
                        type="time"
                        id="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : `Add ${type === 'expense' ? 'Expense' : 'Income'}`}
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