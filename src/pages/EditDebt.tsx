import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Debt, PaymentSchedule } from '../types/debt';
import { AlertCircle, Trash2, ArrowLeft } from 'lucide-react';

export default function EditDebt() {
  const { debtId } = useParams<{ debtId: string }>();
  const [_debt, setDebt] = useState<Debt | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'owe' as 'owe' | 'owed',
    counterpartyName: '',
    totalAmount: 0,
    paymentType: 'single' as 'single' | 'multiple',
    dueDate: '',
    numberOfPayments: 0,
    frequency: 'weekly' as 'weekly' | 'monthly',
    startDate: '',
  });
  const [canEditFinancial, setCanEditFinancial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  // Convert Firestore timestamps to Date objects
  const convertTimestampFieldsToDate = (data: any) => {
    const debtData = { ...data };
    if (debtData.createdAt && typeof debtData.createdAt.toDate === 'function') {
      debtData.createdAt = debtData.createdAt.toDate();
    }
    if (debtData.updatedAt && typeof debtData.updatedAt.toDate === 'function') {
      debtData.updatedAt = debtData.updatedAt.toDate();
    }
    if (debtData.paymentSchedule) {
      debtData.paymentSchedule = debtData.paymentSchedule.map((payment: any) => ({
        ...payment,
        dueDate: payment.dueDate && typeof payment.dueDate.toDate === 'function' 
          ? payment.dueDate.toDate() 
          : payment.dueDate,
      }));
    }
    return debtData;
  };

  // Fetch Debt data and determine edit permissions
  useEffect(() => {
    async function fetchDebt() {
      if (!currentUser || !debtId) return;
      
      try {
        const debtDocRef = doc(db, 'users', currentUser.uid, 'debts', debtId);
        const debtDoc = await getDoc(debtDocRef);
        
        if (!debtDoc.exists()) {
          setError('Debt not found');
          setLoading(false);
          return;
        }
        
        const debtData = convertTimestampFieldsToDate(debtDoc.data()) as Debt;
        setDebt(debtData);
        
        // Check if any payments have been made
        const hasPayments = debtData.paymentSchedule.some(p => p.isPaid);
        setCanEditFinancial(!hasPayments);
        
        // Determine payment type and related values
        const isSinglePayment = debtData.paymentSchedule.length === 1;
        const paymentType = isSinglePayment ? 'single' : 'multiple';
        
        // Set form data
        setFormData({
          name: debtData.name,
          type: debtData.type,
          counterpartyName: debtData.counterpartyName,
          totalAmount: debtData.totalAmount,
          paymentType,
          dueDate: isSinglePayment ? debtData.paymentSchedule[0].dueDate.toISOString().slice(0, 10) : '',
          numberOfPayments: isSinglePayment ? 1 : debtData.paymentSchedule.length,
          frequency: determineFrequency(debtData.paymentSchedule),
          startDate: !isSinglePayment ? debtData.paymentSchedule[0].dueDate.toISOString().slice(0, 10) : '',
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching debt:', error);
        setError('Failed to load debt details');
        setLoading(false);
      }
    }
    
    fetchDebt();
  }, [currentUser, db, debtId]);

  // Determine frequency (weekly or monthly) based on payment schedule
  function determineFrequency(schedule: PaymentSchedule[]): 'weekly' | 'monthly' {
    if (schedule.length <= 1) return 'weekly'; // Default
    
    const firstDate = schedule[0].dueDate;
    const secondDate = schedule[1].dueDate;
    const daysDiff = Math.round((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 28 ? 'monthly' : 'weekly';
  }

  // Generate payment schedule based on form data
  function generatePaymentSchedule(): PaymentSchedule[] {
    const schedule = [];
    const amount = formData.totalAmount;
    
    if (formData.paymentType === 'single') {
      schedule.push({ 
        dueDate: new Date(formData.dueDate), 
        amount, 
        isPaid: false 
      });
    } else {
      const numPayments = formData.numberOfPayments;
      const amountPerPayment = amount / numPayments;
      let currentDate = new Date(formData.startDate);
      
      for (let i = 0; i < numPayments; i++) {
        schedule.push({ 
          dueDate: new Date(currentDate), 
          amount: amountPerPayment, 
          isPaid: false 
        });
        
        // Add time based on frequency
        if (formData.frequency === 'weekly') {
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 7);
          currentDate = nextDate;
        } else {
          const nextDate = new Date(currentDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
          currentDate = nextDate;
        }
      }
    }
    
    return schedule;
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Debt name is required');
      return;
    }
    
    if (formData.totalAmount <= 0) {
      setError('Total amount must be greater than zero');
      return;
    }
    
    try {
      setUpdating(true);
      setError('');
      
      const debtDocRef = doc(db, 'users', currentUser!.uid, 'debts', debtId!);
      
      if (canEditFinancial) {
        // Validate payment schedule data
        if (formData.paymentType === 'single' && !formData.dueDate) {
          setError('Please enter a due date');
          setUpdating(false);
          return;
        }
        
        if (formData.paymentType === 'multiple') {
          if (!formData.startDate || formData.numberOfPayments < 2) {
            setError('Please enter valid multiple payment details');
            setUpdating(false);
            return;
          }
        }
        
        // Regenerate payment schedule if financial fields are editable
        const paymentSchedule = generatePaymentSchedule();
        
        await updateDoc(debtDocRef, {
          name: formData.name,
          type: formData.type,
          counterpartyName: formData.counterpartyName,
          totalAmount: formData.totalAmount,
          paymentSchedule,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Only update non-financial fields
        await updateDoc(debtDocRef, {
          name: formData.name,
          type: formData.type,
          counterpartyName: formData.counterpartyName,
          updatedAt: serverTimestamp(),
        });
      }
      
      toast.success('Debt updated successfully');
      navigate(`/debt/${debtId}`);
    } catch (error) {
      console.error('Error updating debt:', error);
      setError('Failed to update debt');
      setUpdating(false);
    }
  }

  // Handle Debt deletion
  async function handleDeleteDebt() {
    try {
      setUpdating(true);
      
      await deleteDoc(doc(db, 'users', currentUser!.uid, 'debts', debtId!));
      
      toast.success('Debt deleted successfully');
      navigate('/debt');
    } catch (error) {
      console.error('Error deleting debt:', error);
      toast.error('Failed to delete debt');
      setUpdating(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg">Loading debt details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="flex items-center mb-6">
              <Link to={`/debt/${debtId}`} className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                Edit Debt
              </h2>
            </div>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
            
            {!canEditFinancial && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <p className="text-sm text-yellow-700">
                    Financial fields (total amount, payment schedule, etc.) cannot be edited because payments have been made. To modify these, all payments must be marked as unpaid first.
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <div className="mt-1 flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="owe"
                          checked={formData.type === 'owe'}
                          onChange={() => setFormData(prev => ({ ...prev, type: 'owe' }))}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">I Owe Money</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="owed"
                          checked={formData.type === 'owed'}
                          onChange={() => setFormData(prev => ({ ...prev, type: 'owed' }))}
                          className="form-radio text-indigo-600"
                        />
                        <span className="ml-2">Money Owed to Me</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Debt Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="counterpartyName" className="block text-sm font-medium text-gray-700">
                      {formData.type === 'owe' ? 'Lender Name' : 'Borrower Name'}
                    </label>
                    <input
                      type="text"
                      id="counterpartyName"
                      value={formData.counterpartyName}
                      onChange={(e) => setFormData(prev => ({ ...prev, counterpartyName: e.target.value }))}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">
                      Total Amount (PHP)
                    </label>
                    <input
                      type="number"
                      id="totalAmount"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) }))}
                      required
                      min="1"
                      step="0.01"
                      readOnly={!canEditFinancial}
                      className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${!canEditFinancial ? 'bg-gray-100' : ''}`}
                    />
                  </div>
                  
                  {canEditFinancial && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                      <div className="mt-1 flex space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            value="single"
                            checked={formData.paymentType === 'single'}
                            onChange={() => setFormData(prev => ({ ...prev, paymentType: 'single' }))}
                            className="form-radio text-indigo-600"
                          />
                          <span className="ml-2">Single Payment</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            value="multiple"
                            checked={formData.paymentType === 'multiple'}
                            onChange={() => setFormData(prev => ({ ...prev, paymentType: 'multiple' }))}
                            className="form-radio text-indigo-600"
                          />
                          <span className="ml-2">Multiple Payments</span>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {canEditFinancial && formData.paymentType === 'single' && (
                    <div>
                      <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">Due Date</label>
                      <input
                        type="date"
                        id="dueDate"
                        value={formData.dueDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                  )}
                  
                  {canEditFinancial && formData.paymentType === 'multiple' && (
                    <>
                      <div>
                        <label htmlFor="numberOfPayments" className="block text-sm font-medium text-gray-700">Number of Payments</label>
                        <input
                          type="number"
                          id="numberOfPayments"
                          value={formData.numberOfPayments}
                          onChange={(e) => setFormData(prev => ({ ...prev, numberOfPayments: parseInt(e.target.value) }))}
                          required
                          min="2"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Frequency</label>
                        <select
                          id="frequency"
                          value={formData.frequency}
                          onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as 'weekly' | 'monthly' }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                          value={formData.startDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
                
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center">
                  <div>
                    {!deleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Debt
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleDeleteDebt}
                          disabled={updating}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(false)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 sm:mt-0">
                    <button
                      type="submit"
                      disabled={updating}
                      className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}