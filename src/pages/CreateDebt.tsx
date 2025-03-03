import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { ArrowLeft } from 'lucide-react';

export default function CreateDebt() {
  const [type, setType] = useState<'owe' | 'owed'>('owe');
  const [name, setName] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'single' | 'multiple'>('single');
  const [dueDate, setDueDate] = useState('');
  const [numberOfPayments, setNumberOfPayments] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  function generatePaymentSchedule(): { dueDate: Date; amount: number; isPaid: boolean }[] {
    const schedule = [];
    const amount = parseFloat(totalAmount);
    if (paymentType === 'single') {
      schedule.push({ dueDate: new Date(dueDate), amount, isPaid: false });
    } else {
      const numPayments = parseInt(numberOfPayments);
      const amountPerPayment = amount / numPayments;
      let currentDate = new Date(startDate);
      for (let i = 0; i < numPayments; i++) {
        schedule.push({ dueDate: new Date(currentDate), amount: amountPerPayment, isPaid: false });
        if (frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }
    return schedule;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be logged in');
      return;
    }

    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      setError('Please enter a valid total amount');
      return;
    }

    if (paymentType === 'single' && !dueDate) {
      setError('Please enter a due date');
      return;
    }

    if (paymentType === 'multiple') {
      const numPayments = parseInt(numberOfPayments);
      if (!startDate || isNaN(numPayments) || numPayments <= 0) {
        setError('Please enter valid multiple payment details');
        return;
      }
      if (total % numPayments !== 0) {
        setError('Total amount must be evenly divisible by number of payments');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const paymentSchedule = generatePaymentSchedule();
      const debtData = {
        type,
        name,
        counterpartyName,
        totalAmount: total,
        paymentSchedule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const debtRef = await addDoc(collection(db, 'users', currentUser.uid, 'debts'), debtData);
      toast.success('Debt created successfully!');
      navigate(`/debt/${debtRef.id}`);
    } catch (error) {
      console.error('Error creating debt:', error);
      setError('Failed to create debt');
      toast.error('Failed to create debt');
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
            <div className="mb-6 flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">
                Create New Debt
              </h1>
            </div>
            <div className="bg-white shadow rounded-lg">
              <form onSubmit={handleSubmit} className="p-6">
                {error && <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <div className="mt-1 flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="owe"
                          checked={type === 'owe'}
                          onChange={() => setType('owe')}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">I Owe Money</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="owed"
                          checked={type === 'owed'}
                          onChange={() => setType('owed')}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">Money Owed to Me</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Debt Name</label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700">
                      {type === 'owe' ? 'Lender Name' : 'Borrower Name'}
                    </label>
                    <input
                      type="text"
                      id="counterparty"
                      value={counterpartyName}
                      onChange={(e) => setCounterpartyName(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">Total Amount (PHP)</label>
                    <input
                      type="number"
                      id="totalAmount"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      required
                      min="1"
                      step="0.01"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                    <div className="mt-1 flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="single"
                          checked={paymentType === 'single'}
                          onChange={() => setPaymentType('single')}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">Single Payment</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="multiple"
                          checked={paymentType === 'multiple'}
                          onChange={() => setPaymentType('multiple')}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">Multiple Payments</span>
                      </label>
                    </div>
                  </div>
                  {paymentType === 'single' ? (
                    <div>
                      <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">Due Date</label>
                      <input
                        type="date"
                        id="dueDate"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="numberOfPayments" className="block text-sm font-medium text-gray-700">Number of Payments</label>
                        <input
                          type="number"
                          id="numberOfPayments"
                          value={numberOfPayments}
                          onChange={(e) => setNumberOfPayments(e.target.value)}
                          required
                          min="2"
                          className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Frequency</label>
                        <select
                          id="frequency"
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly')}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input
                          type="date"
                          id="startDate"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/debt')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Debt'}
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