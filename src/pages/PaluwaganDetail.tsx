import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Calendar, Check, X, AlertCircle } from 'lucide-react';

export default function PaluwaganDetail() {
  const { paluwaganId } = useParams<{ paluwaganId: string }>();
  const [paluwagan, setPaluwagan] = useState<Paluwagan | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'payment' | 'payout' | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
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
        // Fetch paluwagan details
        const docRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const paluwaganData = convertTimestampFieldsToDate(docSnap.data()) as Paluwagan;
          setPaluwagan(paluwaganData);
        } else {
          setError('Paluwagan not found');
        }

        // Fetch user accounts
        const accountsCollectionRef = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);
        const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          setSelectedAccountId(accountsData[0].id); // Default to first account
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

  // Handle marking payment or payout with account selection
  async function handleConfirmAction() {
    if (!selectedAccountId || !modalType || !paluwagan || !currentUser || !paluwaganId) return;

    try {
      setLoading(true);
      const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);

      if (modalType === 'payment' && selectedWeek !== null) {
        const payment = paluwagan.weeklyPayments.find(p => p.weekNumber === selectedWeek);
        if (!payment) throw new Error('Payment not found');

        // Create expense transaction
        const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
        await setDoc(transactionDocRef, {
          type: 'expense',
          amount: payment.amount,
          description: `Paluwagan payment for week ${selectedWeek}`,
          category: 'Paluwagan',
          accountId: selectedAccountId,
          date: new Date(),
          createdAt: new Date(),
        });

        // Update account balance
        const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId);
        await updateDoc(accountDocRef, { balance: increment(-payment.amount) });

        // Update paluwagan with payment status and account
        const updatedWeeklyPayments = paluwagan.weeklyPayments.map(p =>
          p.weekNumber === selectedWeek ? { ...p, isPaid: true, accountId: selectedAccountId } : p
        );
        await updateDoc(paluwaganRef, {
          weeklyPayments: updatedWeeklyPayments,
          updatedAt: serverTimestamp(),
        });
        setPaluwagan(prev => prev ? { ...prev, weeklyPayments: updatedWeeklyPayments } : null);
        toast.success('Payment marked as paid');
      } else if (modalType === 'payout' && selectedNumber !== null) {
        const numData = paluwagan.numbers.find(n => n.number === selectedNumber);
        if (!numData) throw new Error('Number not found');
        if (!isPayoutDateValid(numData.payoutDate)) {
          toast.error('Cannot mark as received before the payout date');
          return;
        }

        // Create income transaction
        const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
        await setDoc(transactionDocRef, {
          type: 'income',
          amount: paluwagan.payoutPerNumber,
          description: `Paluwagan payout for number ${selectedNumber}`,
          category: 'Paluwagan',
          accountId: selectedAccountId,
          date: new Date(),
          createdAt: new Date(),
        });

        // Update account balance
        const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', selectedAccountId);
        await updateDoc(accountDocRef, { balance: increment(paluwagan.payoutPerNumber) });

        // Update paluwagan with payout status and account
        const updatedNumbers = paluwagan.numbers.map(n =>
          n.number === selectedNumber ? { ...n, isPaid: true, accountId: selectedAccountId } : n
        );
        await updateDoc(paluwaganRef, {
          numbers: updatedNumbers,
          updatedAt: serverTimestamp(),
        });
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
      setSelectedWeek(null);
      setSelectedNumber(null);
    }
  }

  // Handle unmarking payment (reversal)
  async function handleUnmarkPayment(weekNumber: number) {
    if (!confirm('This will create a reversal transaction to add back the amount to the account. Continue?')) return;
    if (!paluwagan || !currentUser || !paluwaganId) return;

    try {
      const payment = paluwagan.weeklyPayments.find(p => p.weekNumber === weekNumber);
      if (!payment || !payment.accountId) throw new Error('Payment or account not found');

      // Create reversal income transaction
      const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
      await setDoc(transactionDocRef, {
        type: 'income',
        amount: payment.amount,
        description: `Reversal of paluwagan payment for week ${weekNumber}`,
        category: 'Paluwagan',
        accountId: payment.accountId,
        date: new Date(),
        createdAt: new Date(),
      });

      // Update account balance
      const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', payment.accountId);
      await updateDoc(accountDocRef, { balance: increment(payment.amount) });

      // Update paluwagan
      const paluwaganRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
      const updatedWeeklyPayments = paluwagan.weeklyPayments.map(p =>
        p.weekNumber === weekNumber ? { ...p, isPaid: false } : p
      );
      await updateDoc(paluwaganRef, {
        weeklyPayments: updatedWeeklyPayments,
        updatedAt: serverTimestamp(),
      });
      setPaluwagan(prev => prev ? { ...prev, weeklyPayments: updatedWeeklyPayments } : null);
      toast.success('Payment marked as unpaid');
    } catch (error) {
      console.error('Error unmarking payment:', error);
      toast.error('Failed to unmark payment');
    }
  }

  // Handle unmarking payout (reversal)
  async function handleUnmarkPayout(number: number) {
    if (!confirm('This will create a reversal transaction to subtract the amount from the account. Continue?')) return;
    if (!paluwagan || !currentUser || !paluwaganId) return;

    try {
      const numData = paluwagan.numbers.find(n => n.number === number);
      if (!numData || !numData.accountId) throw new Error('Number or account not found');

      // Create reversal expense transaction
      const transactionDocRef = doc(db, 'users', currentUser.uid, 'transactions', Date.now().toString());
      await setDoc(transactionDocRef, {
        type: 'expense',
        amount: paluwagan.payoutPerNumber,
        description: `Reversal of paluwagan payout for number ${number}`,
        category: 'Paluwagan',
        accountId: numData.accountId,
        date: new Date(),
        createdAt: new Date(),
      });

      // Update account balance
      const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', numData.accountId);
      await updateDoc(accountDocRef, { balance: increment(-paluwagan.payoutPerNumber) });

      // Update paluwagan
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

  // Format date for display
  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  // Check if payout date is valid (on or after today)
  function isPayoutDateValid(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const payoutDate = new Date(date);
    payoutDate.setHours(0, 0, 0, 0);
    return payoutDate <= today;
  }

  // Render account selection modal
  const renderModal = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto h-full w-full backdrop-blur-sm bg-black/20">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative my-8 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {modalType === 'payment' ? 'Select Account for Payment' : 'Select Account for Payout'}
          </h3>
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

  const totalPaidToDate = paluwagan.weeklyPayments
    .filter(payment => payment.isPaid)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalReceivedToDate = userNumbers
    .filter(num => num.isPaid)
    .reduce((sum) => sum + paluwagan.payoutPerNumber, 0);
  const currentNetPosition = totalReceivedToDate - totalPaidToDate;

  const totalWeeks = paluwagan.weeklyPayments.length;
  const currentWeekIndex = paluwagan.weeklyPayments.findIndex(payment => {
    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= today;
  });
  const currentWeek = currentWeekIndex !== -1 ? currentWeekIndex + 1 : totalWeeks;
  const progressPercentage = Math.min(Math.round((currentWeek / totalWeeks) * 100), 100);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <h2 className="text-2xl font-bold text-gray-900">{paluwagan.name}</h2>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <Calendar className="mr-1.5 h-5 w-5" />
              Started: {formatDate(paluwagan.startDate)}
            </div>

            {/* Progress Tracker */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Paluwagan Progress</h3>
                <div className="mt-3">
                  <div className="relative pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600">Week {currentWeek} of {totalWeeks}</span>
                      <span className="text-xs font-semibold text-indigo-600">{progressPercentage}%</span>
                    </div>
                    <div className="overflow-hidden h-2 mt-1 text-xs flex rounded bg-indigo-200">
                      <div style={{ width: `${progressPercentage}%` }} className="bg-indigo-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Financial Summary</h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="text-sm font-medium text-gray-500">Total Paid to Date</div>
                    <div className="mt-1 text-3xl font-semibold text-gray-900">₱{totalPaidToDate.toLocaleString()}</div>
                  </div>
                  <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="text-sm font-medium text-gray-500">Total Received to Date</div>
                    <div className="mt-1 text-3xl font-semibold text-gray-900">₱{totalReceivedToDate.toLocaleString()}</div>
                  </div>
                  <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="text-sm font-medium text-gray-500">Current Net Position</div>
                    <div className="mt-1 text-3xl font-semibold text-gray-900">₱{currentNetPosition.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Payout */}
            {nextPayout && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Next Payout</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Number: <span className="font-medium text-gray-900">{nextPayout.number}</span></p>
                      <p className="text-sm text-gray-500">Date: <span className="font-medium text-gray-900">{formatDate(nextPayout.payoutDate)}</span></p>
                    </div>
                    <div className="text-2xl font-semibold text-green-600">₱{paluwagan.payoutPerNumber.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Tracking */}
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium text-gray-900">Payment Tracking</h3>
                <p className="mt-1 text-sm text-gray-500">Track your weekly payments</p>
              </div>
              <div className="border-t border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paluwagan.weeklyPayments.map(payment => (
                      <tr key={payment.weekNumber}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Week {payment.weekNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(payment.dueDate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payment.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {payment.isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.isPaid ? (
                            <button
                              onClick={() => handleUnmarkPayment(payment.weekNumber)}
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
                                setModalType('payment');
                                setSelectedWeek(payment.weekNumber);
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
                    ))}
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
                <div className="border-t border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
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