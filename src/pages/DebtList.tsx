import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Plus, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Debt } from '../types/debt';

export default function DebtList() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const db = getFirestore();

  useEffect(() => {
    async function fetchDebts() {
      if (!currentUser) return;
      try {
        const debtsCollectionRef = collection(db, 'users', currentUser.uid, 'debts');
        const debtsQuery = query(debtsCollectionRef, orderBy('createdAt', 'desc'));
        const debtsSnapshot = await getDocs(debtsQuery);
        const debtsData = debtsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            paymentSchedule: data.paymentSchedule.map((ps: any) => ({
              ...ps,
              dueDate: ps.dueDate?.toDate(),
            })),
          } as Debt;
        });
        setDebts(debtsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching debts:', error);
        setLoading(false);
      }
    }
    fetchDebts();
  }, [currentUser, db]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function calculateRemainingAmount(debt: Debt): number {
    return debt.paymentSchedule.filter(ps => !ps.isPaid).reduce((sum, ps) => sum + ps.amount, 0);
  }

  function getNextDueDate(debt: Debt): Date | null {
    const unpaidSchedules = debt.paymentSchedule
      .filter(ps => !ps.isPaid)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return unpaidSchedules.length > 0 ? unpaidSchedules[0].dueDate : null;
  }

  function getDebtStatus(debt: Debt) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const unpaidSchedules = debt.paymentSchedule.filter(ps => !ps.isPaid);
    
    if (unpaidSchedules.length === 0) {
      return {
        status: 'Paid Off',
        hasAlert: false,
        alertType: null
      };
    }

    const hasOverdue = unpaidSchedules.some(ps => ps.dueDate < today);
    if (hasOverdue) {
      return {
        status: 'Overdue',
        hasAlert: true,
        alertType: 'overdue'
      };
    }

    const nextDue = getNextDueDate(debt);
    if (nextDue) {
      const diffMs = nextDue.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays <= 7) {
        return {
          status: 'Due Soon',
          hasAlert: true,
          alertType: 'due-soon'
        };
      }
    }

    return {
      status: 'On Track',
      hasAlert: false,
      alertType: null
    };
  }

  function calculateProgressPercentage(debt: Debt): number {
    const totalPayments = debt.paymentSchedule.length;
    if (totalPayments === 0) return 0;
    
    const paidPayments = debt.paymentSchedule.filter(ps => ps.isPaid).length;
    return Math.min(Math.round((paidPayments / totalPayments) * 100), 100);
  }

  const oweDebts = debts.filter(debt => debt.type === 'owe');
  const owedDebts = debts.filter(debt => debt.type === 'owed');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading your debts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate pb-2">Debt Management</h2>
                <p className="mt-1 text-sm text-gray-500">Track your debts and credits</p>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <Link
                  to="/debt/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  New Debt
                </Link>
              </div>
            </div>

            {/* Money You Owe */}
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Money You Owe</h3>
              {oweDebts.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {oweDebts.map(debt => {
                    const remaining = calculateRemainingAmount(debt);
                    const nextDue = getNextDueDate(debt);
                    const { status, hasAlert, alertType } = getDebtStatus(debt);
                    const isSinglePayment = debt.paymentSchedule.length === 1;
                    const progressPercentage = calculateProgressPercentage(debt);

                    return (
                      <Link to={`/debt/${debt.id}`} className="block" key={debt.id}>
                        <div className="bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-shadow h-full">
                          <div className="px-4 py-5 sm:p-6 flex flex-col h-full">
                            <div className="flex items-center">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <h3 className="text-lg font-medium text-indigo-600 truncate">{debt.name}</h3>
                                </div>
                                <p className="text-sm text-gray-500">To: {debt.counterpartyName}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Total</p>
                                <p className="text-lg font-semibold">{formatCurrency(debt.totalAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Remaining</p>
                                <p className="text-lg font-semibold">{formatCurrency(remaining)}</p>
                              </div>
                            </div>
                            {/* Middle section with progress bar or spacer */}
                            <div className="mt-3 flex-grow">
                              {!isSinglePayment && (
                                <div className="relative pt-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-indigo-600">Progress</span>
                                    <span className="text-xs font-semibold text-indigo-600">{progressPercentage}%</span>
                                  </div>
                                  <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-indigo-100">
                                    <div 
                                      style={{ width: `${progressPercentage}%` }} 
                                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Bottom section with details and status */}
                            <div className="mt-3 space-y-3">
                              {nextDue && (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="text-sm text-gray-600">Next Due</span>
                                  </div>
                                  <span className="text-sm font-medium text-indigo-600">
                                    {formatDate(nextDue)}
                                  </span>
                                </div>
                              )}
                              {status === 'Paid Off' && (
                                <div className="flex items-center justify-between text-green-600 bg-green-50 p-2 rounded-md">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  <span className="text-xs">
                                    {isSinglePayment ? 'Payment complete' : 'All payments complete'}
                                  </span>
                                </div>
                              )}
                              {hasAlert && alertType === 'overdue' && (
                                <div className="flex items-center justify-between text-red-600 bg-red-50 p-2 rounded-md">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Payment overdue</span>
                                </div>
                              )}
                              {hasAlert && alertType === 'due-soon' && (
                                <div className="flex items-center justify-between text-amber-600 bg-amber-50 p-2 rounded-md">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Payment due this week</span>
                                </div>
                              )}
                              {!hasAlert && status === 'On Track' && (
                                <div className="flex items-center justify-between text-blue-600 bg-blue-50 p-2 rounded-md">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  <span className="text-xs">
                                    {isSinglePayment ? 'Payment not due yet' : 'All payments up to date'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-white shadow rounded-lg">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Debts</h3>
                  <p className="mt-1 text-sm text-gray-500">You don't owe anyone yet.</p>
                </div>
              )}
            </div>

            {/* Money Owed to You */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Money Owed to You</h3>
              {owedDebts.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {owedDebts.map(debt => {
                    const remaining = calculateRemainingAmount(debt);
                    const nextDue = getNextDueDate(debt);
                    const { status, hasAlert, alertType } = getDebtStatus(debt);
                    const isSinglePayment = debt.paymentSchedule.length === 1;
                    const progressPercentage = calculateProgressPercentage(debt);

                    return (
                      <Link to={`/debt/${debt.id}`} className="block" key={debt.id}>
                        <div className="bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-shadow h-full">
                          <div className="px-4 py-5 sm:p-6 flex flex-col h-full">
                            <div className="flex items-center">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <h3 className="text-lg font-medium text-indigo-600 truncate">{debt.name}</h3>
                                </div>
                                <p className="text-sm text-gray-500">From: {debt.counterpartyName}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Total</p>
                                <p className="text-lg font-semibold">{formatCurrency(debt.totalAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Remaining</p>
                                <p className="text-lg font-semibold">{formatCurrency(remaining)}</p>
                              </div>
                            </div>
                            {/* Middle section with progress bar or spacer */}
                            <div className="mt-3 flex-grow">
                              {!isSinglePayment && (
                                <div className="relative pt-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-indigo-600">Progress</span>
                                    <span className="text-xs font-semibold text-indigo-600">{progressPercentage}%</span>
                                  </div>
                                  <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-indigo-100">
                                    <div 
                                      style={{ width: `${progressPercentage}%` }} 
                                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Bottom section with details and status */}
                            <div className="mt-3 space-y-3">
                              {nextDue && (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="text-sm text-gray-600">Next Due</span>
                                  </div>
                                  <span className="text-sm font-medium text-indigo-600">
                                    {formatDate(nextDue)}
                                  </span>
                                </div>
                              )}
                              {status === 'Paid Off' && (
                                <div className="flex items-center justify-between text-green-600 bg-green-50 p-2 rounded-md">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  <span className="text-xs">
                                    {isSinglePayment ? 'Payment received' : 'All payments received'}
                                  </span>
                                </div>
                              )}
                              {hasAlert && alertType === 'overdue' && (
                                <div className="flex items-center justify-between text-red-600 bg-red-50 p-2 rounded-md">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Payment overdue</span>
                                </div>
                              )}
                              {hasAlert && alertType === 'due-soon' && (
                                <div className="flex items-center justify-between text-amber-600 bg-amber-50 p-2 rounded-md">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Payment due this week</span>
                                </div>
                              )}
                              {!hasAlert && status === 'On Track' && (
                                <div className="flex items-center justify-between text-blue-600 bg-blue-50 p-2 rounded-md">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  <span className="text-xs">
                                    {isSinglePayment ? 'Payment not due yet' : 'All payments up to date'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-white shadow rounded-lg">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Credits</h3>
                  <p className="mt-1 text-sm text-gray-500">No one owes you yet.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}