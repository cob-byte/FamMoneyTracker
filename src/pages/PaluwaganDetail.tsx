import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  getDocs, 
  setDoc, 
  increment 
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Paluwagan } from '../types/paluwagan';
import { Calendar, Check, X, AlertCircle, DollarSign, ArrowLeft } from 'lucide-react';

export default function PaluwaganDetail() {
  const { paluwaganId } = useParams<{ paluwaganId: string }>();
  const [paluwagan, setPaluwagan] = useState<Paluwagan | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'payment' | 'payout' | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<'unpaid' | 'paid' | null>(null);
  const [weeksToPay, setWeeksToPay] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'deduct' | 'mark'>('deduct');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  // Convert Firestore timestamps to Date objects
  const convertTimestampFieldsToDate = (data: any) => {
    const paluwaganData = { ...data };
    if (paluwaganData.startDate && typeof paluwaganData.startDate.toDate === 'function') {
      paluwaganData.startDate = paluwaganData.startDate.toDate();
    }
    if (paluwaganData.numbers) {
      paluwaganData.numbers = paluwaganData.numbers.map((num: any) => ({
        ...num,
        payoutDate: num.payoutDate && typeof num.payoutDate.toDate === 'function' 
          ? num.payoutDate.toDate() 
          : num.payoutDate,
      }));
    }
    if (paluwaganData.weeklyPayments) {
      paluwaganData.weeklyPayments = paluwaganData.weeklyPayments.map((payment: any) => ({
        ...payment,
        dueDate: payment.dueDate && typeof payment.dueDate.toDate === 'function'
          ? payment.dueDate.toDate()
          : payment.dueDate,
      }));
    }
    return paluwaganData;
  };

  // Fetch paluwagan and accounts data
  useEffect(() => {
    async function fetchData() {
      if (!paluwaganId || !currentUser) return;

      try {
        const docRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const paluwaganData = convertTimestampFieldsToDate(docSnap.data()) as Paluwagan;
          setPaluwagan(paluwaganData);
        } else {
          setError('Paluwagan not found');
        }

        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);
        const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          setSelectedAccountId(accountsData[0].id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [paluwaganId, currentUser, db]);

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

  // Handle payment confirmation (single or bulk)
  async function handleConfirmAction() {
    if (!modalType || !paluwagan || !currentUser || !paluwaganId) return;

    try {
      setLoading(true);

      if (modalType === 'payment') {
        const totalAmount = weeksToPay.reduce((sum, week) => {
          const payment = paluwagan.weeklyPayments.find(p => p.weekNumber === week);
          return sum + (payment ? payment.amount : 0);
        }, 0);

        const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);

        let updatedWeeklyPayments;
        if (paymentMethod === 'deduct') {
          if (!selectedAccountId) {
            toast.error('Please select an account');
            return;
          }
          const selectedAccount = accounts.find(account => account.id === selectedAccountId);
          if (!selectedAccount) throw new Error('Selected account not found');

          if (totalAmount > selectedAccount.balance) {
            toast.error(`Insufficient funds in ${selectedAccount.name}. Available balance: ₱${selectedAccount.balance.toFixed(2)}`);
            return;
          }

          const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
          await setDoc(transactionDocRef, {
            type: 'expense',
            amount: totalAmount,
            description: `Paluwagan payment for weeks ${weeksToPay.join(', ')}`,
            category: 'Paluwagan',
            accountId: selectedAccountId,
            accountName: selectedAccount.name,
            date: new Date(),
            createdAt: new Date(),
          });

          const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId);
          await updateDoc(accountDocRef, { balance: increment(-totalAmount) });

          updatedWeeklyPayments = paluwagan.weeklyPayments.map(p =>
            weeksToPay.includes(p.weekNumber) ? { ...p, isPaid: true, accountId: selectedAccountId } : p
          );
        } else {
          // Mark as paid only
          updatedWeeklyPayments = paluwagan.weeklyPayments.map(p =>
            weeksToPay.includes(p.weekNumber) ? { ...p, isPaid: true } : p
          );
        }

        await updateDoc(paluwaganRef, {
          weeklyPayments: updatedWeeklyPayments,
          updatedAt: serverTimestamp(),
        });
        fetchAccounts();
        setPaluwagan(prev => prev ? { ...prev, weeklyPayments: updatedWeeklyPayments } : null);
        toast.success('Payments marked as paid');
        setSelectedWeeks([]);
        setSelectionMode(null);
      } else if (modalType === 'payout' && selectedNumber !== null) {
        const numData = paluwagan.numbers.find(n => n.number === selectedNumber);
        if (!numData) throw new Error('Number not found');
        if (!isPayoutDateValid(numData.payoutDate)) {
          toast.error('Cannot mark as received before the payout date');
          return;
        }

        const selectedAccount = accounts.find(account => account.id === selectedAccountId);
        if (!selectedAccount) throw new Error('Selected account not found');

        const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
        await setDoc(transactionDocRef, {
          type: 'income',
          amount: paluwagan.payoutPerNumber,
          description: `Paluwagan payout for number ${selectedNumber}`,
          category: 'Paluwagan',
          accountId: selectedAccountId,
          accountName: selectedAccount.name,
          date: new Date(),
          createdAt: new Date(),
        });

        const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId);
        await updateDoc(accountDocRef, { balance: increment(paluwagan.payoutPerNumber) });

        const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
        const updatedNumbers = paluwagan.numbers.map(n =>
          n.number === selectedNumber ? { ...n, isPaid: true, accountId: selectedAccountId } : n
        );
        await updateDoc(paluwaganRef, {
          numbers: updatedNumbers,
          updatedAt: serverTimestamp(),
        });
        fetchAccounts();
        setPaluwagan(prev => prev ? { ...prev, numbers: updatedNumbers } : null);
        toast.success('Payout marked as received');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Failed to perform action');
    } finally {
      setLoading(false);
      setIsModalOpen(false);
      setModalType(null);
      setSelectedNumber(null);
      setWeeksToPay([]);
      setPaymentMethod('deduct');
    }
  }

  // Handle unmarking payments (single or bulk)
  async function handleUnmarkPayments(weekNumbers: number[]) {
    if (!confirm(`This will set ${weekNumbers.length} payment(s) as unpaid. If any were deducted from an account, reversal transactions will be created. Continue?`)) return;
    if (!paluwagan || !currentUser || !paluwaganId) return;

    try {
      const paymentsToUnmark = paluwagan.weeklyPayments.filter(p => weekNumbers.includes(p.weekNumber) && p.isPaid);
      if (paymentsToUnmark.length !== weekNumbers.length) throw new Error('Some payments not found or already unpaid');

      // Handle reversals only for payments with accountId
      for (const payment of paymentsToUnmark) {
        if (payment.accountId) {
          const account = accounts.find(acc => acc.id === payment.accountId);
          if (!account) throw new Error(`Account not found for week ${payment.weekNumber}`);

          const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
          await setDoc(transactionDocRef, {
            type: 'income',
            amount: payment.amount,
            description: `Reversal of paluwagan payment for week ${payment.weekNumber}`,
            category: 'Paluwagan',
            accountId: payment.accountId,
            accountName: account.name,
            date: new Date(),
            createdAt: new Date(),
          });

          const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', payment.accountId);
          await updateDoc(accountDocRef, { balance: increment(payment.amount) });
        }
      }

      // Update weeklyPayments
      const updatedWeeklyPayments = paluwagan.weeklyPayments.map(p =>
        weekNumbers.includes(p.weekNumber) ? { ...p, isPaid: false } : p
      );
      const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
      await updateDoc(paluwaganRef, {
        weeklyPayments: updatedWeeklyPayments,
        updatedAt: serverTimestamp(),
      });
      fetchAccounts();
      setPaluwagan(prev => prev ? { ...prev, weeklyPayments: updatedWeeklyPayments } : null);
      toast.success(`${weekNumbers.length} payment(s) marked as unpaid`);
      setSelectedWeeks([]);
      setSelectionMode(null);
    } catch (error) {
      console.error('Error unmarking payments:', error);
      toast.error('Failed to unmark payments');
    }
  }

  // Handle unmarking payout
  async function handleUnmarkPayout(number: number) {
    if (!confirm('This will create a reversal transaction to subtract the amount from the account. Continue?')) return;
    if (!paluwagan || !currentUser || !paluwaganId) return;

    try {
      const numData = paluwagan.numbers.find(n => n.number === number);
      if (!numData || !numData.accountId) throw new Error('Number or account not found');
      
      const account = accounts.find(acc => acc.id === numData.accountId);
      if (!account) throw new Error('Account not found');

      if (paluwagan.payoutPerNumber > account.balance) {
        toast.error(`Insufficient funds in ${account.name}. Available balance: ₱${account.balance.toFixed(2)}`);
        return;
      }

      const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
      await setDoc(transactionDocRef, {
        type: 'expense',
        amount: paluwagan.payoutPerNumber,
        description: `Reversal of paluwagan payout for number ${number}`,
        category: 'Paluwagan',
        accountId: numData.accountId,
        accountName: account.name,
        date: new Date(),
        createdAt: new Date(),
      });

      const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', numData.accountId);
      await updateDoc(accountDocRef, { balance: increment(-paluwagan.payoutPerNumber) });

      const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
      const updatedNumbers = paluwagan.numbers.map(n =>
        n.number === number ? { ...n, isPaid: false } : n
      );
      await updateDoc(paluwaganRef, {
        numbers: updatedNumbers,
        updatedAt: serverTimestamp(),
      });
      setPaluwagan(prev => prev ? { ...prev, numbers: updatedNumbers } : null);
      toast.success('Payout marked as unreceived');
    } catch (error) {
      console.error('Error unmarking payout:', error);
      toast.error('Failed to unmark payout');
    }
  }

  // Handle checkbox change
  const handleCheckboxChange = (weekNumber: number, isPaid: boolean) => {
    // Toggle the checkbox (add or remove weekNumber from selectedWeeks)
    const newSelectedWeeks = selectedWeeks.includes(weekNumber)
      ? selectedWeeks.filter(w => w !== weekNumber)
      : [...selectedWeeks, weekNumber];
  
    // If no weeks are selected, reset selectionMode
    if (newSelectedWeeks.length === 0) {
      setSelectionMode(null); // This clears the mode, enabling all checkboxes
    } 
    // If this is the first selection, set the mode based on isPaid
    else if (selectionMode === null) {
      setSelectionMode(isPaid ? 'paid' : 'unpaid');
    }
  
    setSelectedWeeks(newSelectedWeeks);
  };

  // Format date for display
  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  // Check if payout date is valid
  function isPayoutDateValid(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const payoutDate = new Date(date);
    payoutDate.setHours(0, 0, 0, 0);
    return payoutDate <= today;
  }

  // Render modal for payment or payout
  const renderModal = () => {
    if (modalType === 'payment') {
      const totalAmount = weeksToPay.reduce((sum, week) => {
        const payment = paluwagan!.weeklyPayments.find(p => p.weekNumber === week);
        return sum + (payment ? payment.amount : 0);
      }, 0);

      return (
        <div className="fixed inset-0 z-50 overflow-y-auto h-full w-full backdrop-blur-sm bg-black/20">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative my-8 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Payment</h3>
              <p className="text-sm text-gray-600">Paying for weeks: {weeksToPay.join(', ')}</p>
              <p className="text-sm text-gray-600">Total Amount: ₱{totalAmount.toLocaleString()}</p>
              <div className="mt-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    value="deduct"
                    checked={paymentMethod === 'deduct'}
                    onChange={() => setPaymentMethod('deduct')}
                  />
                  <span className="ml-2">Deduct from Account</span>
                </label>
                <label className="inline-flex items-center ml-6">
                  <input
                    type="radio"
                    className="form-radio"
                    value="mark"
                    checked={paymentMethod === 'mark'}
                    onChange={() => setPaymentMethod('mark')}
                  />
                  <span className="ml-2">Mark as Paid Only</span>
                </label>
                {paymentMethod === 'mark' && (
                  <p className="text-xs text-gray-500 mt-1">This marks the payments as paid without deducting from any account (e.g., for payments made outside the system).</p>
                )}
              </div>
              {paymentMethod === 'deduct' && (
                <div className="mt-4">
                  <label htmlFor="account" className="block text-sm font-medium text-gray-700">Account</label>
                  <select
                    id="account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modalType === 'payout') {
      return (
        <div className="fixed inset-0 z-50 overflow-y-auto h-full w-full backdrop-blur-sm bg-black/20">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative my-8 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Account for Payout</h3>
              <div className="mb-4">
                <label htmlFor="account" className="block text-sm font-medium text-gray-700">Account</label>
                <select
                  id="account"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} (₱{account.balance?.toFixed(2) || '0.00'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg">Loading paluwagan details...</p>
      </div>
    );
  }

  if (error || !paluwagan) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Sidebar />
        <div className="md:pl-64 flex flex-col flex-1">
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <p className="text-sm text-red-700">{error || 'Paluwagan not found'}</p>
              </div>
              <button
                onClick={() => navigate('/paluwagan')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Back to Paluwagan List
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const userNumbers = paluwagan.numbers.filter(num => num.isOwner);
  const projectedPayouts = userNumbers.sort((a, b) => a.payoutDate.getTime() - b.payoutDate.getTime());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextPayout = projectedPayouts.find(num => {
    const payoutDate = new Date(num.payoutDate);
    payoutDate.setHours(0, 0, 0, 0);
    return payoutDate >= today && !num.isPaid;
  });

  // Financial summary calculations
  const totalPaid = paluwagan.weeklyPayments
    .filter(payment => payment.isPaid)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalReceived = userNumbers
    .filter(num => num.isPaid)
    .reduce((sum) => sum + paluwagan.payoutPerNumber, 0);

  // Progress calculation
  const totalWeeks = paluwagan.weeklyPayments.length;
  const completedWeeks = paluwagan.weeklyPayments.filter(payment => payment.isPaid).length;
  const progressPercentage = Math.min(Math.round((completedWeeks / totalWeeks) * 100), 100);

  // Upcoming payments (due within 7 days)
  const upcomingPayments = paluwagan.weeklyPayments.filter(payment => {
    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return !payment.isPaid && diffDays <= 7 && diffDays >= 0;
  });

  // Account map for displaying account names
  const accountMap = accounts.reduce((map, acc) => {
    map[acc.id] = acc.name;
    return map;
  }, {} as { [key: string]: string });

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            {/* Header */}
            <div className="flex items-center">
              <Link to="/paluwagan" className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold text-gray-900">
                {paluwagan?.name || 'Paluwagan Details'}
              </h2>
              <Link
                to={`/paluwagan/${paluwaganId}/edit`}
                className="ml-4 inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Edit
              </Link>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <Calendar className="mr-1.5 h-5 w-5" />
              Started: {formatDate(paluwagan.startDate)}
            </div>

            {/* Progress Tracker */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Paluwagan Progress</h3>
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                    {progressPercentage}% Complete
                  </span>
                </div>
                <div className="mt-3">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                          Week {completedWeeks} of {totalWeeks}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-indigo-600">
                          {completedWeeks}/{totalWeeks} Weeks Paid
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-indigo-200">
                      <div style={{ width: `${progressPercentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Financial Summary</h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="bg-gray-50 overflow-hidden shadow-sm rounded-lg border border-gray-200">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                          <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                          <div className="text-sm font-medium text-gray-500">Total Paid</div>
                          <div className="mt-1 text-3xl font-bold text-gray-900">₱{totalPaid.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 overflow-hidden shadow-sm rounded-lg border border-gray-200">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                          <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                          <div className="text-sm font-medium text-gray-500">Total Received</div>
                          <div className="mt-1 text-3xl font-bold text-gray-900">₱{totalReceived.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Payout */}
            {nextPayout && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Next Payout</h3>
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Coming Soon
                    </span>
                  </div>
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-full p-2">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-gray-700">Number: <span className="font-semibold text-gray-900">{nextPayout.number}</span></p>
                          <p className="text-sm text-gray-700">Date: <span className="font-semibold text-gray-900">{formatDate(nextPayout.payoutDate)}</span></p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-600">₱{paluwagan.payoutPerNumber.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Payments Alert */}
            {upcomingPayments.length > 0 && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Upcoming Payments</h3>
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      {upcomingPayments.length} Due Soon
                    </span>
                  </div>
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Attention needed</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            You have {upcomingPayments.length} payment{upcomingPayments.length > 1 ? 's' : ''} due within the next 7 days:
                          </p>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {upcomingPayments.map(payment => (
                              <li key={payment.weekNumber}>
                                Week {payment.weekNumber}: ₱{payment.amount.toLocaleString()} due on {formatDate(payment.dueDate)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Tracking */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium text-gray-900">Payment Tracking</h3>
                <p className="mt-1 text-sm text-gray-500">Track your weekly contributions to the paluwagan</p>
              </div>
              <div className="px-4 py-3 sm:px-6">
                <button
                  disabled={selectedWeeks.length === 0}
                  onClick={() => {
                    if (accounts.length === 0) {
                      toast.error('Please create an account first');
                      return;
                    }
                    if (selectionMode === 'unpaid') {
                      setWeeksToPay(selectedWeeks);
                      setModalType('payment');
                      setIsModalOpen(true);
                    } else if (selectionMode === 'paid') {
                      handleUnmarkPayments(selectedWeeks);
                    }
                  }}
                  className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    selectedWeeks.length === 0
                      ? 'bg-gray-300'
                      : selectionMode === 'unpaid'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {selectionMode === 'unpaid' ? 'Pay Selected Weeks' : selectionMode === 'paid' ? 'Unmark Selected as Unpaid' : 'Select Weeks'}
                </button>
              </div>
              <div className="border-t border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paluwagan.weeklyPayments.map(payment => {
                      const isDueSoon = upcomingPayments.some(p => p.weekNumber === payment.weekNumber);
                      return (
                        <tr key={payment.weekNumber} className={isDueSoon ? 'bg-yellow-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedWeeks.includes(payment.weekNumber)}
                              onChange={() => handleCheckboxChange(payment.weekNumber, payment.isPaid)}
                              disabled={selectionMode !== null && selectionMode !== (payment.isPaid ? 'paid' : 'unpaid')}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Week {payment.weekNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(payment.dueDate)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{payment.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              payment.isPaid 
                                ? 'bg-green-100 text-green-800 ring-1 ring-green-400' 
                                : isDueSoon 
                                  ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-400' 
                                  : 'bg-red-100 text-red-800 ring-1 ring-red-400'
                            }`}>
                              {payment.isPaid 
                                ? `Paid${payment.accountId ? ` from ${accountMap[payment.accountId]}` : ''}` 
                                : isDueSoon 
                                  ? 'Due Soon' 
                                  : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.isPaid ? (
                              <button
                                onClick={() => handleUnmarkPayments([payment.weekNumber])}
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Mark as Unpaid
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (accounts.length === 0) {
                                    toast.error('Please create an account first');
                                    return;
                                  }
                                  setWeeksToPay([payment.weekNumber]);
                                  setModalType('payment');
                                  setIsModalOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Mark as Paid
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

            {/* Projected Payouts */}
            {projectedPayouts.length > 0 && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg font-medium text-gray-900">Projected Payouts</h3>
                  <p className="mt-1 text-sm text-gray-500">Upcoming payouts for your numbers</p>
                </div>
                <div className="border-t border-gray-200 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payout Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projectedPayouts.map(num => {
                        const canReceive = isPayoutDateValid(num.payoutDate);
                        return (
                          <tr key={num.number}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{num.number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(num.payoutDate)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-500 font-medium">₱{paluwagan.payoutPerNumber.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {num.isPaid ? (
                                <button
                                  onClick={() => handleUnmarkPayout(num.number)}
                                  className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Mark as Unreceived
                                </button>
                              ) : canReceive ? (
                                <button
                                  onClick={() => {
                                    if (accounts.length === 0) {
                                      toast.error('Please create an account first');
                                      return;
                                    }
                                    setModalType('payout');
                                    setSelectedNumber(num.number);
                                    setIsModalOpen(true);
                                  }}
                                  className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Mark as Received
                                </button>
                              ) : (
                                <div className="inline-flex items-center text-xs text-amber-700">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  Not yet available
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Back Button */}
            <div className="mt-6">
              <button
                onClick={() => navigate('/paluwagan')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Back to Paluwagan List
              </button>
            </div>

            {isModalOpen && renderModal()}
          </div>
        </main>
      </div>
    </div>
  );
}