import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  PlusCircle, 
  MinusCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  CreditCard, 
  Edit,
  Trash2,
  Wallet, Building, DollarSign, Smartphone
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Account, Transaction } from '../types/account';

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState('PHP');
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionLimit] = useState(5);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    date: '',
    time: '',
  });
  const [modalError, setModalError] = useState('');

  const { currentUser } = useAuth();
  const db = getFirestore();

  const currencySymbols: { [key: string]: string } = {
    PHP: '₱',
    USD: '$',
    EUR: '€'
  };

  const expenseCategories = [
    'Food', 'Transport', 'Utilities', 'Rent', 'Entertainment',
    'Shopping', 'Health', 'Education', 'Subscriptions', 'Other'
  ];
  const incomeCategories = [
    'Salary', 'Bonus', 'Refund', 'Gift', 'Interest', 'Investment', 'Other'
  ];

  function getAccountIcon(accountType: string) {
    switch(accountType) {
      case 'cash':
        return <DollarSign className="h-8 w-8 text-indigo-600 mr-3" />;
      case 'bank':
        return <Building className="h-8 w-8 text-indigo-600 mr-3" />;
      case 'credit':
        return <CreditCard className="h-8 w-8 text-indigo-600 mr-3" />;
      case 'ewallet':
        return <Smartphone className="h-8 w-8 text-indigo-600 mr-3" />;
      default:
        return <Wallet className="h-8 w-8 text-indigo-600 mr-3" />;
    }
  }

  useEffect(() => {
    async function fetchUserDataAndAccount() {
      if (!currentUser || !accountId) return;
      
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().currency) {
          setCurrency(userDoc.data().currency);
        }
        
        const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
        const accountDoc = await getDoc(accountDocRef);
        
        if (!accountDoc.exists()) {
          setError('Account not found');
          setLoading(false);
          return;
        }
        
        setAccount({
          id: accountDoc.id,
          ...accountDoc.data(),
          createdAt: accountDoc.data().createdAt?.toDate()
        } as Account);
        
        await fetchTransactions();
        setLoading(false);
      } catch (error) {
        console.error('Error fetching account details:', error);
        setError('Failed to load account details');
        setLoading(false);
      }
    }
    
    fetchUserDataAndAccount();
  }, [currentUser, db, accountId]);

  useEffect(() => {
    if (editingTransaction) {
      const transactionDate = editingTransaction.date || new Date();
      setFormData({
        description: editingTransaction.description,
        amount: editingTransaction.amount.toString(),
        type: editingTransaction.type,
        category: editingTransaction.category || '',
        date: transactionDate.toISOString().slice(0, 10),
        time: transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setModalError('');
    }
  }, [editingTransaction]);

  async function fetchTransactions(loadMore = false) {
    if (!currentUser || !accountId) return;
    
    try {
      setTransactionsLoading(true);
      
      const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
      
      let transactionsQuery = loadMore && lastVisible
        ? query(
            transactionsCollectionRef,
            where('accountId', '==', accountId),
            orderBy('date', 'desc'),
            startAfter(lastVisible),
            limit(transactionLimit)
          )
        : query(
            transactionsCollectionRef,
            where('accountId', '==', accountId),
            orderBy('date', 'desc'),
            limit(transactionLimit)
          );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      setHasMoreTransactions(transactionsSnapshot.docs.length === transactionLimit);
      
      if (transactionsSnapshot.docs.length > 0) {
        setLastVisible(transactionsSnapshot.docs[transactionsSnapshot.docs.length - 1]);
      } else {
        setLastVisible(null);
      }
      
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        accountId: accountId
      })) as Transaction[];
      
      if (loadMore) {
        setTransactions(prev => [...prev, ...transactionsData]);
      } else {
        setTransactions(transactionsData);
      }
      
      setTransactionsLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
      setTransactionsLoading(false);
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!window.confirm('Are you sure you want to revert this transaction?')) return;

    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) throw new Error('Transaction not found');

      const { type, amount } = transaction;
      const batch = writeBatch(db);

      // Check if deleting this transaction would result in a negative balance
      const adjustment = type === 'income' ? -amount : amount;
      const newBalance = (account?.balance || 0) + adjustment;
      
      // If we're deleting an income transaction and it would cause a negative balance
      if (type === 'income' && newBalance < 0) {
        toast.error('Cannot revert this transaction: it would result in a negative balance');
        return;
      }

      const accountRef = doc(db, 'users', currentUser!.uid, 'accounts', accountId!);
      batch.update(accountRef, { balance: increment(adjustment) });

      const transactionRef = doc(db, 'users', currentUser!.uid, 'transactions', transactionId);
      batch.delete(transactionRef);

      await batch.commit();

      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      setAccount(prev => prev ? { ...prev, balance: prev.balance + adjustment } : null);
      toast.success('Transaction reverted successfully');
    } catch (error) {
      console.error('Error reverting transaction:', error);
      toast.error('Failed to revert transaction');
    }
  }

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
        date: newDate,
      };

      const originalTransaction = editingTransaction!;
      const originalAdjustment = originalTransaction.type === 'income' 
        ? -originalTransaction.amount 
        : originalTransaction.amount;
      const newAdjustment = formData.type === 'income' ? newAmount : -newAmount;

      const totalAdjustment = originalAdjustment + newAdjustment;
      const newBalance = (account?.balance || 0) + totalAdjustment;
      
      // Check if the updated transaction would result in a negative balance
      if (newBalance < 0) {
        setModalError(`This expense would exceed the current balance of ${formatAmount(account?.balance || 0)}. Please reduce the amount or choose a different account.`);
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);

      const accountRef = doc(db, 'users', currentUser!.uid, 'accounts', accountId!);
      batch.update(accountRef, { balance: increment(totalAdjustment) });

      const transactionRef = doc(db, 'users', currentUser!.uid, 'transactions', editingTransaction!.id);
      batch.update(transactionRef, updatedTransaction);

      await batch.commit();

      setTransactions(prev =>
        prev.map(t =>
          t.id === editingTransaction!.id ? { ...t, ...updatedTransaction } : t
        )
      );
      setAccount(prev => prev ? { ...prev, balance: prev.balance + totalAdjustment } : null);
      setEditingTransaction(null);
      toast.success('Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      setModalError('Failed to update transaction');
    } finally {
      setLoading(false);
    }
  }

  function loadMoreTransactions() {
    fetchTransactions(true);
  }

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

  function getAccountTypeName(type: string) {
    const accountTypes: { [key: string]: string } = {
      cash: 'Cash',
      bank: 'Bank Account',
      credit: 'Credit Card',
      ewallet: 'E-Wallet'
    };
    return accountTypes[type] || type;
  }

  function getTransactionIcon(type: string) {
    return type === 'income' 
      ? <PlusCircle className="h-5 w-5 text-green-500" />
      : <MinusCircle className="h-5 w-5 text-red-500" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading account details...</p>
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
            <div className="flex items-center mb-6">
              <Link to="/accounts" className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                {account?.name || 'Account Details'}
              </h2>
            </div>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
            
            {account && (
              <>
                {/* Account overview */}
                <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center">
                          {getAccountIcon(account.type)}
                          <div>
                            <div className="text-sm font-medium text-gray-500">{getAccountTypeName(account.type)}</div>
                            <div className="text-lg font-medium">{account.name}</div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Current Balance</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900">
                          {formatAmount(account.balance || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Created On</div>
                        <div className="mt-1 text-lg">
                          {account.createdAt ? formatDate(account.createdAt) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-end space-x-2">
                    <Link
                      to={`/add-transaction?accountId=${account.id}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Add Transaction
                    </Link>
                    <Link
                      to={`/edit-account/${account.id}`}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Edit Account
                    </Link>
                  </div>
                </div>

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

                {/* Transactions section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Account Transactions</h3>
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
                                  <div className="text-sm text-gray-500">
                                    {transaction.category}
                                  </div>
                                  <div className="flex text-sm text-gray-500">
                                    <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                    <span>{formatDate(transaction.date)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <div className={`text-sm font-medium mr-4 ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
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
                        ))
                      ) : (
                        <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
                          No transactions found for this account
                        </li>
                      )}
                    </ul>
                    
                    {hasMoreTransactions && (
                      <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-center">
                        <button
                          onClick={loadMoreTransactions}
                          disabled={transactionsLoading}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {transactionsLoading ? (
                            <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-2" />
                          )}
                          Load More
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}