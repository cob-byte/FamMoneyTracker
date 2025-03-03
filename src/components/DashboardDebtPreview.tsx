import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
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

  function isDueSoon(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }

  function getDebtStatus(debt: Debt): 'Paid Off' | 'Overdue' | 'Due Soon' | 'On Track' {
    const remaining = calculateRemainingAmount(debt);
    if (remaining === 0) return 'Paid Off';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasOverdue = debt.paymentSchedule.some(ps => !ps.isPaid && ps.dueDate < today);
    if (hasOverdue) return 'Overdue';
    const nextDue = getNextDueDate(debt);
    if (nextDue && isDueSoon(nextDue)) return 'Due Soon';
    return 'On Track';
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
      <div className="bg-white shadow overflow-hidden sm:rounded-md p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading Debt data...</p>
      </div>
    );
  } else if (debts.length === 0) {
    content = (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="text-center py-8">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Debts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a new debt or loan.
          </p>
          <div className="mt-6">
            <Link
              to="/debt/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
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
          const remaining = calculateRemainingAmount(debt);
          const nextDue = getNextDueDate(debt);
          const status = getDebtStatus(debt);
          const dueSoon = status === 'Due Soon';
          const isOwe = debt.type === 'owe';

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
                      <DollarSign className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-base font-medium text-indigo-600 truncate">{debt.name}</h3>
                      <p className="text-xs text-gray-500">
                        {isOwe ? 'To:' : 'From:'} {debt.counterpartyName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Remaining</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Next Due</span>
                      <span className="font-medium text-indigo-600">
                        {formatDate(nextDue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${
                        status === 'Paid Off' ? 'text-green-600' : 
                        status === 'Overdue' ? 'text-red-600' : 
                        status === 'Due Soon' ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {status}
                      </span>
                      {status === 'Overdue' && (
                        <div className="flex items-center text-red-600 bg-red-50 p-1.5 rounded">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">{isOwe ? 'Payment overdue' : 'Overdue'}</span>
                        </div>
                      )}
                      {dueSoon && (
                        <div className="flex items-center text-yellow-600 bg-yellow-50 p-1.5 rounded">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">Due soon</span>
                        </div>
                      )}
                      {status === 'Paid Off' && (
                        <div className="flex items-center text-green-600 bg-green-50 p-1.5 rounded">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          <span className="text-xs">{isOwe ? 'Paid off' : 'All received'}</span>
                        </div>
                      )}
                    </div>
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