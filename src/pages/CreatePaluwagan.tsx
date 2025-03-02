import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { PaluwaganNumber, WeeklyPayment } from '../types/paluwagan';

export default function CreatePaluwagan() {
  const [name, setName] = useState('');
  const [amountPerNumber, setAmountPerNumber] = useState('');
  const [payoutPerNumber, setPayoutPerNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [totalNumbers, setTotalNumbers] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  // Automatically calculate payout per number
  useEffect(() => {
    // Only calculate when both values are present
    if (amountPerNumber && totalNumbers) {
      const amount = parseFloat(amountPerNumber);
      const total = parseInt(totalNumbers);
      
      // The payout is the amount multiplied by the total number of participants
      if (!isNaN(amount) && !isNaN(total) && total > 0) {
        setPayoutPerNumber((amount * total).toFixed(2));
      }
    }
  }, [amountPerNumber, totalNumbers]);

  function handleNumberSelection(number: number) {
    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(selectedNumbers.filter((num) => num !== number));
    } else {
      setSelectedNumbers([...selectedNumbers, number]);
    }
  }

  function generatePayoutDates(startingDate: Date, totalNums: number): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(startingDate);
    
    // First payout is on the start date
    dates.push(new Date(currentDate));
    
    // Generate subsequent Sundays
    for (let i = 1; i < totalNums; i++) {
      // Find the next Sunday
      do {
        currentDate.setDate(currentDate.getDate() + 1);
      } while (currentDate.getDay() !== 0); // 0 represents Sunday
      
      dates.push(new Date(currentDate));
    }
    
    return dates;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to create a Paluwagan');
      return;
    }
    
    if (selectedNumbers.length === 0) {
      setError('Please select at least one number');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const startDateObj = new Date(startDate);
      const totalNumsInt = parseInt(totalNumbers);
      const amountPerNumberFloat = parseFloat(amountPerNumber);
      const payoutPerNumberFloat = parseFloat(payoutPerNumber);
      
      // Generate payout dates (each Sunday starting from the start date)
      const payoutDates = generatePayoutDates(startDateObj, totalNumsInt);
      
      // Create numbers array
      const numbers: PaluwaganNumber[] = [];
      for (let i = 1; i <= totalNumsInt; i++) {
        // Fix: Make sure ownerName is a string and not undefined
        const isOwned = selectedNumbers.includes(i);
        numbers.push({
          number: i,
          payoutDate: payoutDates[i - 1],
          isPaid: false,
          isOwner: isOwned,
          ownerName: isOwned ? (currentUser.displayName || 'Me') : '' // Use empty string instead of undefined
        });
      }
      
      // Create weekly payments array (one for each number selected per week)
      const weeklyPayments: WeeklyPayment[] = [];
      const totalWeeks = totalNumsInt;
      
      for (let week = 1; week <= totalWeeks; week++) {
        const dueDate = new Date(payoutDates[week - 1]);
        
        weeklyPayments.push({
          weekNumber: week,
          dueDate,
          isPaid: false,
          amount: amountPerNumberFloat * selectedNumbers.length
        });
      }
      
      const paluwaganData = {
        name,
        amountPerNumber: amountPerNumberFloat,
        payoutPerNumber: payoutPerNumberFloat,
        startDate: startDateObj,
        totalNumbers: totalNumsInt,
        organizer,
        description: description || '', // Ensure description is never undefined
        numbers,
        weeklyPayments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const paluwaganRef = await addDoc(
        collection(db, 'users', currentUser.uid, 'paluwagans'),
        paluwaganData
      );
      
      toast.success('Paluwagan created successfully!');
      navigate(`/paluwagan/${paluwaganRef.id}`);
    } catch (error) {
      console.error('Error creating paluwagan:', error);
      setError('Failed to create paluwagan. Please try again.');
      toast.error('Failed to create paluwagan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />

      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                  Create New Paluwagan
                </h2>
              </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <form onSubmit={handleSubmit} className="p-6">
                {error && (
                  <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Paluwagan Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="organizer" className="block text-sm font-medium text-gray-700">
                      Organizer
                    </label>
                    <input
                      type="text"
                      id="organizer"
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="amountPerNumber" className="block text-sm font-medium text-gray-700">
                      Amount Per Number (PHP)
                    </label>
                    <input
                      type="number"
                      id="amountPerNumber"
                      value={amountPerNumber}
                      onChange={(e) => setAmountPerNumber(e.target.value)}
                      required
                      min="1"
                      step="0.01"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="totalNumbers" className="block text-sm font-medium text-gray-700">
                      Total Numbers
                    </label>
                    <input
                      type="number"
                      id="totalNumbers"
                      value={totalNumbers}
                      onChange={(e) => setTotalNumbers(e.target.value)}
                      required
                      min="1"
                      max="100"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="payoutPerNumber" className="block text-sm font-medium text-gray-700">
                      Payout Per Number (PHP)
                    </label>
                    <input
                      type="number"
                      id="payoutPerNumber"
                      value={payoutPerNumber}
                      onChange={(e) => setPayoutPerNumber(e.target.value)}
                      required
                      min="1"
                      step="0.01"
                      readOnly
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-700 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Calculated automatically: Amount Per Number × Total Numbers
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Select Your Numbers (1 to {totalNumbers || 0})
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Selected numbers: {selectedNumbers.sort((a, b) => a - b).join(', ')}
                  </p>
                  <div className="mt-3 grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {Array.from({ length: parseInt(totalNumbers) || 0 }, (_, i) => i + 1).map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => handleNumberSelection(number)}
                        className={`py-2 px-3 text-center rounded-md text-sm font-medium
                          ${
                            selectedNumbers.includes(number)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/paluwagan')}
                    className="mr-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Paluwagan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}