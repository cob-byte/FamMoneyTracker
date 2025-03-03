import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Users, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Paluwagan, PaluwaganNumber, WeeklyPayment } from '../types/paluwagan';

export default function DashboardPaluwaganPreview() {
  const [loading, setLoading] = useState(true);
  const [paluwagans, setPaluwagans] = useState<Paluwagan[]>([]);
  const { currentUser } = useAuth();
  const db = getFirestore();

  useEffect(() => {
    async function fetchPaluwagans() {
      if (!currentUser) return;
      
      try {
        const paluwagansCollectionRef = collection(db, 'users', currentUser.uid, 'paluwagans');
        const paluwagansQuery = query(paluwagansCollectionRef, orderBy('createdAt', 'desc'), limit(3));
        const paluwagansSnapshot = await getDocs(paluwagansQuery);
        
        const paluwagansData = paluwagansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          numbers: doc.data().numbers?.map((num: any) => ({
            ...num,
            payoutDate: num.payoutDate?.toDate()
          })),
          weeklyPayments: doc.data().weeklyPayments?.map((payment: any) => ({
            ...payment,
            dueDate: payment.dueDate?.toDate()
          }))
        })) as Paluwagan[];
        
        setPaluwagans(paluwagansData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching paluwagans:', error);
        setLoading(false);
      }
    }
    
    fetchPaluwagans();
  }, [currentUser, db]);

  function formatDate(date: Date | undefined): string {
    if (!date) return 'Unknown date';
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

  function calculateNextPayout(paluwagan: Paluwagan): PaluwaganNumber | null {
    const today = new Date();
    const upcomingNumbers = paluwagan.numbers
      .filter(num => num.isOwner && new Date(num.payoutDate) > today)
      .sort((a, b) => new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime());
    
    return upcomingNumbers.length > 0 ? upcomingNumbers[0] : null;
  }

  function calculateProgressPercentage(paluwagan: Paluwagan): number {
    const totalWeeks = paluwagan.weeklyPayments.length;
    if (totalWeeks === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentWeekIndex = paluwagan.weeklyPayments.findIndex(payment => {
      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    });
    
    const currentWeek = currentWeekIndex !== -1 ? currentWeekIndex : totalWeeks;
    return Math.min(Math.round((currentWeek / totalWeeks) * 100), 100);
  }

  function getCurrentWeekPayment(paluwagan: Paluwagan): WeeklyPayment | undefined {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return paluwagan.weeklyPayments.find(payment => {
      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const oneWeekAhead = new Date(today);
      oneWeekAhead.setDate(oneWeekAhead.getDate() + 7);
      
      return dueDate >= today && dueDate <= oneWeekAhead && !payment.isPaid;
    });
  }

  function calculateNetPosition(paluwagan: Paluwagan): number {
    const totalPaid = paluwagan.weeklyPayments
      .filter(payment => payment.isPaid)
      .reduce((sum: number, payment) => sum + payment.amount, 0);
    
    const totalReceived = paluwagan.numbers
      .filter(num => num.isOwner && num.isPaid)
      .reduce((sum: number) => sum + paluwagan.payoutPerNumber, 0);
    
    return totalReceived - totalPaid;
  }

  if (loading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading Paluwagan data...</p>
      </div>
    );
  }

  if (paluwagans.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="text-center py-8">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Paluwagan</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new Paluwagan.
          </p>
          <div className="mt-6">
            <Link
              to="/paluwagan/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              New Paluwagan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Your Paluwagan</h3>
        <Link
          to="/paluwagan"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          View all
        </Link>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paluwagans.map((paluwagan) => {
          const nextPayout = calculateNextPayout(paluwagan);
          const progressPercentage = calculateProgressPercentage(paluwagan);
          const currentWeekPayment = getCurrentWeekPayment(paluwagan);
          const myNumbers = paluwagan.numbers.filter(num => num.isOwner).length;
          const netPosition = calculateNetPosition(paluwagan);
          const isPositive = netPosition >= 0;

          return (
            <Link 
              to={`/paluwagan/${paluwagan.id}`} 
              className="block" 
              key={paluwagan.id}
            >
              <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow transition-shadow duration-300 h-full">
                <div className="px-4 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-base font-medium text-indigo-600 truncate">
                        {paluwagan.name}
                      </h3>
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
                          {myNumbers} number{myNumbers !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span className="font-medium">
                          {formatCurrency(Math.abs(netPosition))} {isPositive ? 'gain' : 'contributed'}
                        </span>
                      </div>
                    </div>
                    
                    {nextPayout && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-gray-600">Next payout</span>
                        </div>
                        <span className="font-medium text-indigo-600">
                          {formatDate(nextPayout.payoutDate)}
                        </span>
                      </div>
                    )}
                    
                    {currentWeekPayment ? (
                      <div className="flex items-center justify-between text-amber-600 bg-amber-50 p-1.5 rounded">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs flex-grow">Payment due</span>
                        <span className="text-xs font-medium">
                          {formatDate(currentWeekPayment.dueDate)}
                        </span>
                      </div>
                    ) : (
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
    </div>
  );
}