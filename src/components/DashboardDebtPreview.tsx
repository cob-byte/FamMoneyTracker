import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Debt } from '../types/debt';

export default function DashboardDebtPreview() {
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const { currentUser } = useAuth();
  const db = getFirestore();

  useEffect(() => {
    async function fetchDebts() {
      if (!currentUser) return;
      try {
        const debtsCollectionRef = collection(db, 'users', currentUser.uid, 'debts');
        const debtsQuery = query(debtsCollectionRef, orderBy('createdAt', 'desc'));
        const debtsSnapshot = await getDocs(debtsQuery);

        const debtsData = debtsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          paymentSchedule: doc.data().paymentSchedule.map((ps: any) => ({
            ...ps,
            dueDate: ps.dueDate?.toDate(),
          })),
        })) as Debt[];

        const debtsWithDueDates = debtsData.map(debt => ({
          ...debt,
          nextDueDate: getNextDueDate(debt)
        }));

        // Sort by next due date (earliest first, nulls last)
        const sortedDebts = debtsWithDueDates.sort((a, b) => {
          if (!a.nextDueDate && !b.nextDueDate) return 0;
          if (!a.nextDueDate) return 1;
          if (!b.nextDueDate) return -1;
          return a.nextDueDate.getTime() - b.nextDueDate.getTime();
        });

        // Take the first 3
        setDebts(sortedDebts.slice(0, 3));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching debts:', error);
        setLoading(false);
      }
    }

    fetchDebts();
  }, [currentUser, db]);

  function formatDate(date: Date | null | undefined): string {
    if (!date) return 'Paid Off';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
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

  // First, render the header consistently regardless of loading/empty state
  const header = (
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Debt Management</h3>
      <Link
        to="/debt"
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
      <div className="bg-white shadow overflow-hidden sm:rounded-md p-4">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
        <p className="mt-2 text-sm text-gray-500 text-center">Loading Debt data...</p>
      </div>
    );
  } else if (debts.length === 0) {
    content = (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="text-center py-8">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Debts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a new debt or loan.
          </p>
          <div className="mt-6">
            <Link
              to="/debt/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              New Debt
            </Link>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {debts.map((debt) => {
          const progressPercentage = calculateProgressPercentage(debt);
          const remaining = calculateRemainingAmount(debt);
          const nextDue = getNextDueDate(debt);
          const isOwe = debt.type === 'owe';
          const { status, hasAlert, alertType } = getDebtStatus(debt);

          return (
            <Link 
              to={`/debt/${debt.id}`} 
              className="block" 
              key={debt.id}
            >
              <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow transition-shadow duration-300 h-full">
                <div className="px-4 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-base font-medium text-indigo-600 truncate">
                        {debt.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {isOwe ? 'To:' : 'From:'} {debt.counterpartyName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
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
                  </div>
                  
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-gray-600">
                          {debt.type === 'owe' ? 'Amount owed' : 'Amount to receive'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    
                    {nextDue && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Next payment</span>
                        <span className="font-medium text-indigo-600">
                          {formatDate(nextDue)}
                        </span>
                      </div>
                    )}
                    
                    {status === 'Paid Off' && (
                      <div className="flex items-center justify-between text-green-600 bg-green-50 p-1.5 rounded">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        <span className="text-xs">All payments complete</span>
                      </div>
                    )}

                    {hasAlert && alertType === 'overdue' && (
                      <div className="flex items-center justify-between text-red-600 bg-red-50 p-1.5 rounded">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Payment overdue</span>
                      </div>
                    )}

                    {hasAlert && alertType === 'due-soon' && (
                      <div className="flex items-center justify-between text-amber-600 bg-amber-50 p-1.5 rounded">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Payment due this week</span>
                      </div>
                    )}

                    {!hasAlert && status === 'On Track' && (
                      <div className="flex items-center justify-between text-green-600 bg-green-50 p-1.5 rounded">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        <span className="text-xs">All payments up to date</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
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