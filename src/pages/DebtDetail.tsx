import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, setDoc, increment } from 'firebase/firestore';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Debt } from '../types/debt';
import { Check, X, AlertCircle, ArrowLeft } from 'lucide-react';

export default function DebtDetail() {
  const { debtId } = useParams<{ debtId: string }>();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<'unpaid' | 'paid' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'affectAccount' | 'markOnly'>('affectAccount');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    async function fetchData() {
      if (!debtId || !currentUser) return;
      try {
        const debtRef = doc(db, 'users', currentUser.uid, 'debts', debtId);
        const debtSnap = await getDoc(debtRef);
        if (debtSnap.exists()) {
          const data = debtSnap.data();
          setDebt({
            id: debtSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            paymentSchedule: data.paymentSchedule.map((ps: any) => ({
              ...ps,
              dueDate: ps.dueDate?.toDate(),
            })),
          } as Debt);
        } else {
          setError('Debt not found');
        }

        const accountsRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnap = await getDocs(accountsRef);
        const accountsData = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsData);
        if (accountsData.length > 0) setSelectedAccountId(accountsData[0].id);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [debtId, currentUser, db]);

  function handleCheckboxChange(index: number, isPaid: boolean) {
    setSelectedPayments(prev => {
      const newSelected = prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index];
      if (newSelected.length === 0) {
        setSelectionMode(null);
      } else if (prev.length === 0) {
        setSelectionMode(isPaid ? 'paid' : 'unpaid');
      }
      return newSelected;
    });
  }

  const fetchAccounts = async () => {
    // Check if currentUser is null
    if (!currentUser) {
      console.error('User is not logged in');
      return; // Exit the function early if no user
    }
  
    // Now TypeScript knows currentUser is not null, so accessing uid is safe
    const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
    const accountsSnapshot = await getDocs(accountsCollectionRef);
    const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAccounts(accountsData);
    if (accountsData.length > 0) {
      setSelectedAccountId(accountsData[0].id);
    }
  };

  async function handleConfirmMarkPayments() {
    if (!debt || !currentUser || !debtId || selectedPayments.length === 0) return;
    try {
      setLoading(true);
      const totalAmount = selectedPayments.reduce((sum, idx) => sum + debt.paymentSchedule[idx].amount, 0);
      const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

      if (debt.type === 'owe' && paymentMethod === 'affectAccount') {
        if (!selectedAccount) {
          toast.error('Selected account not found');
          return;
        }
        if (totalAmount > selectedAccount.balance) {
          toast.error(`Insufficient funds in ${selectedAccount.name}. Available: ₱${selectedAccount.balance.toFixed(2)}`);
          return;
        }
      }

      for (const idx of selectedPayments) {
        const payment = debt.paymentSchedule[idx];
        if (paymentMethod === 'affectAccount' && selectedAccount) {
          const transactionRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
          if (debt.type === 'owe') {
            await setDoc(transactionRef, {
              type: 'expense',
              amount: payment.amount,
              description: `Debt payment to ${debt.counterpartyName}`,
              category: 'Debt',
              accountId: selectedAccountId,
              accountName: selectedAccount.name,
              date: new Date(),
              createdAt: new Date(),
            });
            await updateDoc(doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId), {
              balance: increment(-payment.amount),
            });
          } else {
            await setDoc(transactionRef, {
              type: 'income',
              amount: payment.amount,
              description: `Debt payment from ${debt.counterpartyName}`,
              category: 'Debt',
              accountId: selectedAccountId,
              accountName: selectedAccount.name,
              date: new Date(),
              createdAt: new Date(),
            });
            await updateDoc(doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId), {
              balance: increment(payment.amount),
            });
          }
        }
      }

      const updatedSchedule = debt.paymentSchedule.map((ps, idx) =>
        selectedPayments.includes(idx)
          ? paymentMethod === 'affectAccount'
            ? { ...ps, isPaid: true, accountId: selectedAccountId }
            : { ...ps, isPaid: true }
          : ps
      );
      await updateDoc(doc(db, 'users', currentUser.uid, 'debts', debtId), {
        paymentSchedule: updatedSchedule,
        updatedAt: serverTimestamp(),
      });
      fetchAccounts();
      setDebt(prev => prev ? { ...prev, paymentSchedule: updatedSchedule } : null);
      toast.success(`${selectedPayments.length} payment(s) marked as ${debt.type === 'owe' ? 'paid' : 'received'}`);
    } catch (error) {
      console.error('Error marking payments:', error);
      toast.error('Failed to mark payments');
    } finally {
      setLoading(false);
      setIsModalOpen(false);
      setSelectedPayments([]);
      setSelectionMode(null);
    }
  }

  async function handleUnmarkPayments(indices: number[]) {
    if (!confirm(`This will set ${indices.length} payment(s) as unpaid. If any were associated with an account, reversal transactions will be created. Continue?`)) return;
    if (!debt || !currentUser || !debtId) return;
    try {
      setLoading(true);
      for (const idx of indices) {
        const payment = debt.paymentSchedule[idx];
        if (payment.accountId) {
          const account = accounts.find(acc => acc.id === payment.accountId);
          if (!account) throw new Error(`Account not found for payment ${idx + 1}`);
          if (debt.type === 'owe') {
            const transactionRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
            await setDoc(transactionRef, {
              type: 'income',
              amount: payment.amount,
              description: `Reversal of debt payment to ${debt.counterpartyName}`,
              category: 'Debt',
              accountId: payment.accountId,
              accountName: account.name,
              date: new Date(),
              createdAt: new Date(),
            });
            await updateDoc(doc(db, 'users', currentUser.uid, 'accounts', payment.accountId), {
              balance: increment(payment.amount),
            });
          } else {
            if (payment.amount > account.balance) {
              toast.error(`Insufficient funds in ${account.name} to reverse payment ${idx + 1}. Available: ₱${account.balance.toFixed(2)}`);
              return;
            }
            const transactionRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
            await setDoc(transactionRef, {
              type: 'expense',
              amount: payment.amount,
              description: `Reversal of debt payment from ${debt.counterpartyName}`,
              category: 'Debt',
              accountId: payment.accountId,
              accountName: account.name,
              date: new Date(),
              createdAt: new Date(),
            });
            await updateDoc(doc(db, 'users', currentUser.uid, 'accounts', payment.accountId), {
              balance: increment(-payment.amount),
            });
          }
        }
      }

      const updatedSchedule = debt.paymentSchedule.map((ps, idx) =>
        indices.includes(idx) ? { dueDate: ps.dueDate, amount: ps.amount, isPaid: false } : ps
      );
      await updateDoc(doc(db, 'users', currentUser.uid, 'debts', debtId), {
        paymentSchedule: updatedSchedule,
        updatedAt: serverTimestamp(),
      });
      fetchAccounts();
      setDebt(prev => prev ? { ...prev, paymentSchedule: updatedSchedule } : null);
      toast.success(`${indices.length} payment(s) marked as unpaid`);
    } catch (error) {
      console.error('Error unmarking payments:', error);
      toast.error('Failed to unmark payments');
    } finally {
      setLoading(false);
      setSelectedPayments([]);
      setSelectionMode(null);
    }
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  const renderModal = () => {
    if (!debt) return null;
    const totalAmount = selectedPayments.reduce((sum, idx) => sum + debt.paymentSchedule[idx].amount, 0);
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm bg-black/20">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative my-8 mx-auto p-6 border max-w-lg shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm {debt.type === 'owe' ? 'Payment' : 'Receipt'}
            </h3>
            <p className="text-sm text-gray-600">
              {debt.type === 'owe' ? 'Paying' : 'Receiving'} for payments: {selectedPayments.map(idx => `Payment ${idx + 1}`).join(', ')}
            </p>
            <p className="text-sm text-gray-600">Total Amount: ₱{totalAmount.toLocaleString()}</p>
            <div className="mt-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  value="affectAccount"
                  checked={paymentMethod === 'affectAccount'}
                  onChange={() => setPaymentMethod('affectAccount')}
                />
                <span className="ml-2">{debt.type === 'owe' ? 'Deduct from Account' : 'Add to Account'}</span>
              </label>
              <label className="inline-flex items-center ml-6">
                <input
                  type="radio"
                  className="form-radio"
                  value="markOnly"
                  checked={paymentMethod === 'markOnly'}
                  onChange={() => setPaymentMethod('markOnly')}
                />
                <span className="ml-2">{debt.type === 'owe' ? 'Mark as Paid Only' : 'Mark as Received Only'}</span>
              </label>
              {paymentMethod === 'markOnly' && (
                <p className="text-xs text-gray-500 mt-1">
                  This marks the payments as {debt.type === 'owe' ? 'paid' : 'received'} without affecting any account (e.g., for payments made outside the system).
                </p>
              )}
            </div>
            {paymentMethod === 'affectAccount' && (
              <div className="mt-4">
                <label htmlFor="account" className="block text-sm font-medium text-gray-700">Account</label>
                <select
                  id="account"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} (₱{account.balance?.toFixed(2) || '0.00'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMarkPayments}
                className="px-4 py-2 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p>Loading debt details...</p></div>;
  if (error || !debt) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Sidebar />
        <div className="md:pl-64 flex flex-col flex-1">
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <p className="text-sm text-red-700">{error || 'Debt not found'}</p>
              </div>
              <button onClick={() => navigate('/debt')} className="inline-flex px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                Back to Debt List
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const remainingAmount = debt.paymentSchedule.filter(ps => !ps.isPaid).reduce((sum, ps) => sum + ps.amount, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overduePayments = debt.paymentSchedule.filter(ps => !ps.isPaid && ps.dueDate < today);
  const upcomingPayments = debt.paymentSchedule.filter(ps => {
    const dueDate = new Date(ps.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return !ps.isPaid && diffDays <= 7 && diffDays >= 0;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="flex items-center">
              <Link to="/debt" className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold text-gray-900">
                {debt.name || 'Debt Details'}
              </h2>
              <Link
                to={`/debt/${debtId}/edit/`}
                className="ml-4 inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Edit
              </Link>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {debt.type === 'owe' ? `To: ${debt.counterpartyName}` : `From: ${debt.counterpartyName}`}
            </div>

            {/* Summary */}
            <div className="mt-6 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Debt Summary</h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="bg-gray-50 rounded-lg p-5">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">₱{debt.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-5">
                    <p className="text-sm text-gray-500">Remaining Amount</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">₱{remainingAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Overdue Payments */}
            {overduePayments.length > 0 && (
              <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Attention Needed</h3>
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          {overduePayments.length} Overdue Payment{overduePayments.length > 1 ? 's' : ''}
                        </h3>
                        <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
                          {overduePayments.map((ps, idx) => (
                            <li key={idx}>₱{ps.amount.toLocaleString()} due on {formatDate(ps.dueDate)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Payments */}
            {upcomingPayments.length > 0 && (
              <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Attention Needed</h3>
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                      <AlertCircle className="h-6 w-6 text-yellow-500" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          {upcomingPayments.length} Payment{upcomingPayments.length > 1 ? 's' : ''} Due Soon
                        </h3>
                        <ul className="mt-2 text-sm text-yellow-700 list-disc pl-5">
                          {upcomingPayments.map((ps, idx) => (
                            <li key={idx}>₱{ps.amount.toLocaleString()} due on {formatDate(ps.dueDate)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Schedule */}
            <div className="mt-6 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Payment Schedule</h3>
              </div>
              <div className="px-4 py-3 sm:px-6">
                <button
                  disabled={selectedPayments.length === 0}
                  onClick={() => {
                    if (accounts.length === 0) {
                      toast.error('Please create an account first');
                      return;
                    }
                    if (selectionMode === 'unpaid') {
                      setIsModalOpen(true);
                    } else if (selectionMode === 'paid') {
                      handleUnmarkPayments(selectedPayments);
                    }
                  }}
                  className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    selectedPayments.length === 0
                      ? 'bg-gray-300'
                      : selectionMode === 'unpaid'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {selectionMode === 'unpaid'
                    ? `Mark Selected as ${debt.type === 'owe' ? 'Paid' : 'Received'}`
                    : selectionMode === 'paid'
                    ? 'Unmark Selected'
                    : 'Select Payments'}
                </button>
              </div>
              <div className="border-t border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {debt.paymentSchedule.map((payment, index) => {
                      const isDueSoon = upcomingPayments.some(ps => ps.dueDate.getTime() === payment.dueDate.getTime());
                      return (
                        <tr key={index} className={isDueSoon && !payment.isPaid ? 'bg-yellow-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedPayments.includes(index)}
                              onChange={() => handleCheckboxChange(index, payment.isPaid)}
                              disabled={selectionMode !== null && selectionMode !== (payment.isPaid ? 'paid' : 'unpaid')}
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(payment.dueDate)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">₱{payment.amount.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              payment.isPaid ? 'bg-green-100 text-green-800' : isDueSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {payment.isPaid ? 'Paid' : isDueSoon ? 'Due Soon' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {payment.isPaid ? (
                              <button
                                onClick={() => handleUnmarkPayments([index])}
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs text-red-700 bg-red-100 hover:bg-red-200"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Unmark
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (accounts.length === 0) {
                                    toast.error('Please create an account first');
                                    return;
                                  }
                                  setSelectedPayments([index]);
                                  setSelectionMode('unpaid');
                                  setIsModalOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs text-green-700 bg-green-100 hover:bg-green-200"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                {debt.type === 'owe' ? 'Mark Paid' : 'Mark Received'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <button onClick={() => navigate('/debt')} className="inline-flex px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                Back to Debt List
              </button>
            </div>

            {isModalOpen && renderModal()}
          </div>
        </main>
      </div>
    </div>
  );
}