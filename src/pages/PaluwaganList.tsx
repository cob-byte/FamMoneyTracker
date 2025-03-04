import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Plus, Calendar, Users, AlertCircle, CheckCircle2, Gift } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Paluwagan } from '../types/paluwagan';

export default function PaluwaganList() {
  const [loading, setLoading] = useState(true);
  const [paluwagans, setPaluwagans] = useState<Paluwagan[]>([]);
  const { currentUser } = useAuth();
  const db = getFirestore();

  useEffect(() => {
    async function fetchPaluwagans() {
      if (!currentUser) return;
      
      try {
        const paluwagansCollectionRef = collection(db, 'users', currentUser.uid, 'paluwagans');
        const paluwagansQuery = query(paluwagansCollectionRef, orderBy('createdAt', 'desc'));
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
        } as Paluwagan));
        
        setPaluwagans(paluwagansData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching paluwagans:', error);
        setLoading(false);
      }
    }
    
    fetchPaluwagans();
  }, [currentUser, db]);

  function formatDate(date: Date) {
    if (!date) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  function calculateNextPayout(paluwagan: Paluwagan) {
    const today = new Date();
    const upcomingNumbers = paluwagan.numbers
      .filter(num => num.isOwner && new Date(num.payoutDate) > today)
      .sort((a, b) => new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime());
    
    return upcomingNumbers.length > 0 ? upcomingNumbers[0] : null;
  }

  function calculateProgressPercentage(paluwagan: Paluwagan) {
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

  function getCurrentWeekPayment(paluwagan: Paluwagan) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading your Paluwagan data...</p>
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
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Paluwagan</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your Paluwagan contributions and payouts
                </p>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4">
                <Link
                  to="/paluwagan/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  New Paluwagan
                </Link>
              </div>
            </div>

            {paluwagans.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {paluwagans.map((paluwagan) => {
                  const nextPayout = calculateNextPayout(paluwagan);
                  const progressPercentage = calculateProgressPercentage(paluwagan);
                  const currentWeekPayment = getCurrentWeekPayment(paluwagan);
                  const myNumbers = paluwagan.numbers.filter(num => num.isOwner).length;
                  const weeklyDue = paluwagan.amountPerNumber * myNumbers;

                  return (
                    <Link 
                      to={`/paluwagan/${paluwagan.id}`} 
                      className="block" 
                      key={paluwagan.id}
                    >
                      <div className="bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-shadow duration-300">
                        <div className="px-4 py-5 sm:p-6">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                              <Users className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="ml-4">
                              <h3 className="text-lg font-medium text-indigo-600 truncate">
                                {paluwagan.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                Started {formatDate(paluwagan.startDate)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <div className="relative pt-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-indigo-600">Progress</span>
                                <span className="text-xs font-semibold text-indigo-600">{progressPercentage}%</span>
                              </div>
                              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-100">
                                <div 
                                  style={{ width: `${progressPercentage}%` }} 
                                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"
                                ></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-5">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 uppercase">Weekly Due</p>
                              <p className="text-lg font-semibold">{formatCurrency(weeklyDue)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 uppercase">Payout</p>
                              <p className="text-lg font-semibold">{formatCurrency(paluwagan.payoutPerNumber)}</p>
                            </div>
                          </div>
                          
                          <div className="mt-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Users className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-sm text-gray-600">
                                  {myNumbers} number{myNumbers !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            
                            {nextPayout ? (
                              <div className="flex items-center justify-between">
                                <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-sm text-gray-600 flex-grow">Next payout</span>
                                <span className="text-sm font-medium text-indigo-600">
                                  {formatDate(nextPayout.payoutDate)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-green-600 bg-green-50 p-2 rounded-md">
                                <Gift className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-xs flex-grow">All payouts received</span>
                              </div>
                            )}
                            
                            {currentWeekPayment && (
                              <div className="flex items-center justify-between text-amber-600 bg-amber-50 p-2 rounded-md">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                <span className="text-xs flex-grow">Payment due this week</span>
                                <span className="text-xs font-medium">
                                  {formatDate(currentWeekPayment.dueDate)}
                                </span>
                              </div>
                            )}

                            {!currentWeekPayment && (
                              <div className="flex items-center justify-between text-green-600 bg-green-50 p-2 rounded-md">
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
            ) : (
              <div className="text-center py-12 bg-white shadow overflow-hidden sm:rounded-lg">
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
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    New Paluwagan
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}