import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getFirestore,
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  where,
  startAfter,
  doc,
  deleteDoc,
  getDoc,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  AlertCircle,
  PlusCircle,
  MinusCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Menu,
  X,
  Filter,
  Edit,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';

// Define types
interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: Date;
  accountId: string;
  accountName: string;
  category?: string;
}

interface Account {
  id: string;
  name: string;
}

export default function Transactions() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState('PHP');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<{
    type: string;
    account: string;
    dateRange: string;
  }>({
    type: 'all',
    account: 'all',
    dateRange: 'all',
  });
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    accountId: '',
    date: '',
    time: '',
  });
  const [modalError, setModalError] = useState('');

  const { currentUser } = useAuth();
  const db = getFirestore();
  const TRANSACTIONS_PER_PAGE = 15;

  // Currency symbols
  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€',
  };

  // Categories from AddTransaction.tsx
  const expenseCategories = [
    'Food',
    'Transport',
    'Utilities',
    'Rent',
    'Entertainment',
    'Shopping',
    'Health',
    'Education',
    'Subscriptions',
    'Other',
  ];
  const incomeCategories = [
    'Salary',
    'Bonus',
    'Refund',
    'Gift',
    'Interest',
    'Investment',
    'Other',
  ];

  // Fetch initial data
  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data()?.currency) {
          setCurrency(userDoc.data().currency);
        }

        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);

        const accountsData = accountsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }));

        setAccounts(accountsData);
        await fetchTransactions();
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [currentUser]);

  // Set form data when editingTransaction changes
  useEffect(() => {
    if (editingTransaction) {
      const transactionDate = editingTransaction.date || new Date();
      setFormData({
        description: editingTransaction.description,
        amount: editingTransaction.amount.toString(),
        type: editingTransaction.type,
        category: editingTransaction.category || '',
        accountId: editingTransaction.accountId,
        date: transactionDate.toISOString().slice(0, 10),
        time: transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setModalError('');
    }
  }, [editingTransaction]);

  // Reset category if type changes and category is invalid
  useEffect(() => {
    const categories = formData.type === 'expense' ? expenseCategories : incomeCategories;
    if (formData.category && !categories.includes(formData.category)) {
      setFormData((prev) => ({ ...prev, category: '' }));
    }
  }, [formData.type]);

  // Fetch transactions with pagination and filters
  async function fetchTransactions(isLoadMore = false) {
    if (!currentUser) return;

    try {
      setError('');
      if (!isLoadMore) setLoading(true);

      const transactionsRef = collection(db, 'users', currentUser.uid, 'transactions');
      let transactionsQuery = query(
        transactionsRef,
        orderBy('date', 'desc'),
        limit(TRANSACTIONS_PER_PAGE)
      );

      if (filter.type !== 'all') {
        transactionsQuery = query(
          transactionsRef,
          where('type', '==', filter.type),
          orderBy('date', 'desc'),
          limit(TRANSACTIONS_PER_PAGE)
        );
      }

      if (filter.account !== 'all') {
        transactionsQuery = query(
          transactionsRef,
          where('accountId', '==', filter.account),
          orderBy('date', 'desc'),
          limit(TRANSACTIONS_PER_PAGE)
        );
      }

      let dateFilter = null;
      if (filter.dateRange !== 'all') {
        const now = new Date();
        switch (filter.dateRange) {
          case 'today':
            dateFilter = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            dateFilter = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
            dateFilter = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }

        if (dateFilter) {
          transactionsQuery = query(
            transactionsRef,
            where('date', '>=', dateFilter),
            orderBy('date', 'desc'),
            limit(TRANSACTIONS_PER_PAGE)
          );
        }
      }

      if (isLoadMore && lastVisible) {
        transactionsQuery = query(transactionsQuery, startAfter(lastVisible));
      }

      const transactionsSnapshot = await getDocs(transactionsQuery);

      if (transactionsSnapshot.docs.length > 0) {
        setLastVisible(transactionsSnapshot.docs[transactionsSnapshot.docs.length - 1]);
        setHasMore(transactionsSnapshot.docs.length === TRANSACTIONS_PER_PAGE);
      } else {
        setHasMore(false);
      }

      const transactionsData = transactionsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          amount: data.amount || 0,
          description: data.description || 'Unnamed transaction',
          accountName: data.accountName || 'Unknown account',
        } as Transaction;
      });

      if (isLoadMore) {
        setTransactions((prev) => [...prev, ...transactionsData]);
      } else {
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  // Delete transaction and revert account balance
  async function handleDeleteTransaction(transactionId: string) {
    if (!window.confirm('Are you sure you want to revert this transaction?')) return;

    try {
      const transaction = transactions.find((t) => t.id === transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const { type, amount, accountId } = transaction;

      const batch = writeBatch(db);

      // Revert the account balance
      const accountRef = doc(db, 'users', currentUser!.uid, 'accounts', accountId);
      const adjustment = type === 'income' ? -amount : amount; // Income: subtract, Expense: add
      batch.update(accountRef, { balance: increment(adjustment) });

      // Delete the transaction
      const transactionRef = doc(db, 'users', currentUser!.uid, 'transactions', transactionId);
      batch.delete(transactionRef);

      await batch.commit();

      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      toast.success('Transaction reverted successfully');
    } catch (error) {
      console.error('Error reverting transaction:', error);
      toast.error('Failed to revert transaction');
    }
  }

  // Save modified transaction and adjust account balance
  async function handleSave() {
    if (!formData.description.trim()) {
      setModalError('Description is required');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setModalError('Please enter a valid amount');
      return;
    }
    if (!formData.category) {
      setModalError('Please select a category');
      return;
    }
    if (!formData.accountId) {
      setModalError('Please select an account');
      return;
    }

    try {
      setModalError('');
      setLoading(true);

      const newAmount = parseFloat(formData.amount);
      const newDate = new Date(formData.date);
      const [hours, minutes] = formData.time.split(':').map(Number);
      newDate.setHours(hours, minutes, 0, 0);

      const updatedTransaction = {
        description: formData.description,
        amount: newAmount,
        type: formData.type,
        category: formData.category,
        accountId: formData.accountId,
        accountName: accounts.find((a) => a.id === formData.accountId)?.name || '',
        date: newDate,
      };

      const originalTransaction = editingTransaction!;

      const originalAdjustment =
        originalTransaction.type === 'income'
          ? -originalTransaction.amount
          : originalTransaction.amount;
      const newAdjustment = formData.type === 'income' ? newAmount : -newAmount;

      const batch = writeBatch(db);

      const originalAccountRef = doc(
        db,
        'users',
        currentUser!.uid,
        'accounts',
        originalTransaction.accountId
      );
      const newAccountRef = doc(db, 'users', currentUser!.uid, 'accounts', formData.accountId);

      if (originalTransaction.accountId === formData.accountId) {
        const totalAdjustment = originalAdjustment + newAdjustment;
        batch.update(originalAccountRef, { balance: increment(totalAdjustment) });
      } else {
        batch.update(originalAccountRef, { balance: increment(originalAdjustment) });
        batch.update(newAccountRef, { balance: increment(newAdjustment) });
      }

      const transactionRef = doc(
        db,
        'users',
        currentUser!.uid,
        'transactions',
        editingTransaction!.id
      );
      batch.update(transactionRef, updatedTransaction);

      await batch.commit();

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTransaction!.id ? { ...t, ...updatedTransaction } : t
        )
      );
      setEditingTransaction(null);
      toast.success('Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      setModalError('Failed to update transaction');
    } finally {
      setLoading(false);
    }
  }

  // Utility functions
  function formatAmount(amount: number, type?: string) {
    const symbol = currencySymbols[currency] || currency;
    return `${type === 'expense' ? '-' : ''}${symbol}${amount.toFixed(2)}`;
  }

  function formatDate(date: Date) {
    if (!date) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function getTransactionIcon(type: string) {
    return type === 'income' ? (
      <PlusCircle className="h-5 w-5 text-green-500" />
    ) : (
      <MinusCircle className="h-5 w-5 text-red-500" />
    );
  }

  function handleFilterChange(filterType: string, value: string) {
    setFilter((prev) => ({ ...prev, [filterType]: value }));
  }

  function applyFilters() {
    setLastVisible(null);
    setHasMore(true);
    fetchTransactions();
    setIsFilterOpen(false);
  }

  function resetFilters() {
    setFilter({ type: 'all', account: 'all', dateRange: 'all' });
    setLastVisible(null);
    setHasMore(true);
    fetchTransactions();
    setIsFilterOpen(false);
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading transactions...</p>
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                  Transactions
                </h2>
              </div>
              <div className="mt-4 flex md:mt-0 space-x-3">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </button>
                <Link
                  to="/add-transaction"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add Transaction
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

            {/* Filter panel */}
            {isFilterOpen && (
              <div className="bg-white shadow overflow-hidden sm:rounded-md mb-6 p-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700">
                      Transaction Type
                    </label>
                    <select
                      id="filter-type"
                      value={filter.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="all">All</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-account" className="block text-sm font-medium text-gray-700">
                      Account
                    </label>
                    <select
                      id="filter-account"
                      value={filter.account}
                      onChange={(e) => handleFilterChange('account', e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="all">All Accounts</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-date" className="block text-sm font-medium text-gray-700">
                      Date Range
                    </label>
                    <select
                      id="filter-date"
                      value={filter.dateRange}
                      onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={applyFilters}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {editingTransaction && (
            <div
                className="fixed inset-0 z-50 overflow-y-auto h-full w-full backdrop-blur-sm bg-black/20"
                onClick={() => setEditingTransaction(null)}
            >
                <div className="flex items-center justify-center min-h-screen p-4">
                <div
                    className="relative my-8 mx-auto p-4 sm:p-6 border w-full max-w-[90%] sm:max-w-lg md:max-w-3xl shadow-lg rounded-md bg-white overflow-x-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Modify Transaction
                    </h3>
                    {modalError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                        <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                        <p className="text-sm text-red-700">{modalError}</p>
                        </div>
                    </div>
                    )}
                    <form>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                            Transaction Type
                            </label>
                            <div className="flex w-full rounded-md shadow-sm">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
                                className={`relative w-1/2 py-2 text-sm font-medium rounded-l-md focus:outline-none ${
                                formData.type === 'expense'
                                    ? 'bg-red-100 text-red-700 border border-red-500'
                                    : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                                }`}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
                                className={`relative w-1/2 py-2 text-sm font-medium rounded-r-md focus:outline-none ${
                                formData.type === 'income'
                                    ? 'bg-green-100 text-green-700 border border-green-500'
                                    : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                                }`}
                            >
                                Income
                            </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                            Amount
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">
                                {currencySymbols[currency] || currency}
                                </span>
                            </div>
                            <input
                                type="number"
                                name="amount"
                                id="amount"
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-12 sm:text-sm border-gray-300 rounded-md"
                                placeholder="0.00"
                            />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description
                            </label>
                            <input
                            type="text"
                            name="description"
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="What was this transaction for?"
                            />
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                            Category
                            </label>
                            <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                            <option value="">Select a category</option>
                            {(formData.type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                            </select>
                        </div>
                        </div>
                        {/* Right Column */}
                        <div className="space-y-4">
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                            Date
                            </label>
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                                type="date"
                                name="date"
                                id="date"
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                const now = new Date();
                                setFormData(prev => ({
                                    ...prev,
                                    date: now.toISOString().slice(0, 10),
                                    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                }));
                                }}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
                            >
                                Now
                            </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                            Time
                            </label>
                            <input
                            type="time"
                            name="time"
                            id="time"
                            value={formData.time}
                            onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            />
                        </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                        <button
                        type="button"
                        onClick={() => setEditingTransaction(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
                        >
                        Cancel
                        </button>
                        <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
                        >
                        Save Changes
                        </button>
                    </div>
                    </form>
                </div>
                </div>
            </div>
            )}

            {/* Transactions list */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {transactions.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <li key={transaction.id}>
                      <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <div className="flex-shrink-0">{getTransactionIcon(transaction.type)}</div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.description}
                            </div>
                            <Link 
                                to={`/accounts/${transaction.accountId}`} 
                                className="text-sm text-indigo-600 hover:text-indigo-800"
                            >
                                {transaction.accountName}
                            </Link>
                            <div className="flex text-sm text-gray-500">
                              <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              <span>{formatDate(transaction.date)}</span>
                            </div>
                            {transaction.category && (
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                                {transaction.category}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div
                            className={`text-sm font-medium mr-4 ${
                              transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {formatAmount(transaction.amount, transaction.type)}
                          </div>
                          <button
                            onClick={() => setEditingTransaction(transaction)}
                            className="text-gray-400 hover:text-blue-500 mr-2"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-12 sm:px-6 text-center">
                  <div className="flex flex-col items-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      No transactions found
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Get started by adding your first transaction
                    </p>
                    <Link
                      to="/add-transaction"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Add Your First Transaction
                    </Link>
                  </div>
                </div>
              )}

              {hasMore && transactions.length > 0 && (
                <div className="px-4 py-4 sm:px-6 bg-gray-50 flex justify-center">
                  <button
                    onClick={() => fetchTransactions(true)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
                  >
                    Load More
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}