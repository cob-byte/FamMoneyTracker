// src/pages/PaluwaganList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Plus, Calendar, Users } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Paluwagan } from '../types/paluwagan';

export default function PaluwaganList() {
  const [loading, setLoading] = useState(true);
  const [paluwagans, setPaluwagans] = useState<Paluwagan[]>([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading your Paluwagan data...</p>
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
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {paluwagans.map((paluwagan) => {
                    const nextPayout = calculateNextPayout(paluwagan);
                    const myNumbers = paluwagan.numbers.filter(num => num.isOwner).length;
                    const weeklyDue = paluwagan.amountPerNumber * myNumbers;

                    return (
                      <li key={paluwagan.id}>
                        <Link to={`/paluwagan/${paluwagan.id}`} className="block hover:bg-gray-50">
                          <div className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-indigo-600 truncate">
                                  {paluwagan.name}
                                </p>
                              </div>
                              <div className="ml-2 flex-shrink-0 flex">
                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  {formatCurrency(paluwagan.payoutPerNumber)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                              <div className="sm:flex">
                                <p className="flex items-center text-sm text-gray-500">
                                  <Users className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                                  {myNumbers} number{myNumbers !== 1 ? 's' : ''} (
                                  {formatCurrency(weeklyDue)} weekly)
                                </p>
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                <Calendar className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                                <p>
                                  Started {formatDate(paluwagan.startDate)}
                                  {nextPayout && (
                                    <span className="ml-2 text-indigo-600">
                                      Next payout: {formatDate(nextPayout.payoutDate)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
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