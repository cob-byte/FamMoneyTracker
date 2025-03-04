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
import { Paluwagan, PaluwaganNumber, WeeklyPayment } from '../types/paluwagan';
import { AlertCircle, Trash2, ArrowLeft } from 'lucide-react';

export default function EditPaluwagan() {
  const { paluwaganId } = useParams<{ paluwaganId: string }>();
  const [_paluwagan, setPaluwagan] = useState<Paluwagan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    organizer: '',
    description: '',
    startDate: '',
    totalNumbers: 0,
    amountPerNumber: 0,
    payoutPerNumber: 0,
    selectedNumbers: [] as number[],
  });
  const [canEditAll, setCanEditAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
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

  // Fetch Paluwagan data and determine edit permissions
  useEffect(() => {
    async function fetchPaluwagan() {
      if (!currentUser || !paluwaganId) return;
      
      try {
        const paluwaganDocRef = doc(db, 'users', currentUser.uid, 'paluwagans', paluwaganId);
        const paluwaganDoc = await getDoc(paluwaganDocRef);
        
        if (!paluwaganDoc.exists()) {
          setError('Paluwagan not found');
          setLoading(false);
          return;
        }
        
        const paluwaganData = convertTimestampFieldsToDate(paluwaganDoc.data()) as Paluwagan;
        setPaluwagan(paluwaganData);
        
        // Check if any payments or payouts have been made
        const hasPayments = paluwaganData.weeklyPayments.some(p => p.isPaid);
        const hasPayouts = paluwaganData.numbers.some(n => n.isOwner && n.isPaid);
        setCanEditAll(!hasPayments && !hasPayouts);
        
        const selectedNumbers = paluwaganData.numbers.filter(n => n.isOwner).map(n => n.number);
        
        setFormData({
          name: paluwaganData.name,
          organizer: paluwaganData.organizer,
          description: paluwaganData.description || '',
          startDate: paluwaganData.startDate.toISOString().slice(0, 10),
          totalNumbers: paluwaganData.totalNumbers,
          amountPerNumber: paluwaganData.amountPerNumber,
          payoutPerNumber: paluwaganData.payoutPerNumber,
          selectedNumbers,
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching paluwagan:', error);
        setError('Failed to load paluwagan details');
        setLoading(false);
      }
    }
    
    fetchPaluwagan();
  }, [currentUser, db, paluwaganId]);

  // Update payoutPerNumber when amountPerNumber or totalNumbers change
  useEffect(() => {
    if (canEditAll) {
      const amount = parseFloat(formData.amountPerNumber.toString());
      const total = parseInt(formData.totalNumbers.toString());
      if (!isNaN(amount) && !isNaN(total) && total > 0) {
        setFormData(prev => ({ ...prev, payoutPerNumber: amount * total }));
      }
    }
  }, [formData.amountPerNumber, formData.totalNumbers, canEditAll]);

  // Filter selectedNumbers when totalNumbers changes
  useEffect(() => {
    if (canEditAll) {
      const total = parseInt(formData.totalNumbers.toString());
      if (!isNaN(total)) {
        setFormData(prev => ({
          ...prev,
          selectedNumbers: prev.selectedNumbers.filter(num => num <= total),
        }));
      }
    }
  }, [formData.totalNumbers, canEditAll]);

  // Handle number selection in the grid
  function handleNumberSelection(number: number) {
    if (!canEditAll) return;
    setFormData(prev => {
      const selected = prev.selectedNumbers.includes(number)
        ? prev.selectedNumbers.filter(n => n !== number)
        : [...prev.selectedNumbers, number];
      return { ...prev, selectedNumbers: selected };
    });
  }

  // Generate payout dates for regeneration
  function generatePayoutDates(startingDate: Date, totalNums: number): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(startingDate);
    
    // Find the first Sunday (either upcoming Sunday or next Sunday if today is Sunday)
    if (currentDate.getDay() === 0) { // If start date is already a Sunday
      // Move to the next Sunday
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      // Find the upcoming Sunday
      const daysUntilSunday = 7 - currentDate.getDay();
      currentDate.setDate(currentDate.getDate() + daysUntilSunday);
    }
    
    // First payout is on the first Sunday
    dates.push(new Date(currentDate));
    
    // Generate subsequent Sundays
    for (let i = 1; i < totalNums; i++) {
      // Add 7 days to get to the next Sunday
      currentDate.setDate(currentDate.getDate() + 7);
      dates.push(new Date(currentDate));
    }
    
    return dates;
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Paluwagan name is required');
      return;
    }
    
    if (formData.selectedNumbers.length === 0) {
      setError('Please select at least one number');
      return;
    }
    
    try {
      setUpdating(true);
      setError('');
      
      const paluwaganDocRef = doc(db, 'users', currentUser!.uid, 'paluwagans', paluwaganId!);
      
      if (canEditAll) {
        // Regenerate numbers and weeklyPayments if all fields are editable
        const startDateObj = new Date(formData.startDate);
        const totalNumsInt = formData.totalNumbers;
        const amountPerNumberFloat = formData.amountPerNumber;
        const payoutPerNumberFloat = formData.payoutPerNumber;
        
        const payoutDates = generatePayoutDates(startDateObj, totalNumsInt);
        
        const numbers: PaluwaganNumber[] = [];
        for (let i = 1; i <= totalNumsInt; i++) {
          numbers.push({
            number: i,
            payoutDate: payoutDates[i - 1],
            isPaid: false,
            isOwner: formData.selectedNumbers.includes(i),
            ownerName: formData.selectedNumbers.includes(i) ? (currentUser!.displayName || 'Me') : ''
          });
        }
        
        const weeklyPayments: WeeklyPayment[] = [];
        for (let week = 1; week <= totalNumsInt; week++) {
          const dueDate = new Date(payoutDates[week - 1]);
          weeklyPayments.push({
            weekNumber: week,
            dueDate,
            isPaid: false,
            amount: amountPerNumberFloat * formData.selectedNumbers.length
          });
        }
        
        await updateDoc(paluwaganDocRef, {
          name: formData.name,
          organizer: formData.organizer,
          description: formData.description,
          startDate: startDateObj,
          totalNumbers: totalNumsInt,
          amountPerNumber: amountPerNumberFloat,
          payoutPerNumber: payoutPerNumberFloat,
          numbers,
          weeklyPayments,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Only update non-financial fields
        await updateDoc(paluwaganDocRef, {
          name: formData.name,
          organizer: formData.organizer,
          description: formData.description,
          updatedAt: serverTimestamp(),
        });
      }
      
      toast.success('Paluwagan updated successfully');
      navigate(`/paluwagan/${paluwaganId}`);
    } catch (error) {
      console.error('Error updating paluwagan:', error);
      setError('Failed to update paluwagan');
      setUpdating(false);
    }
  }

  // Handle Paluwagan deletion
  async function handleDeletePaluwagan() {
    try {
      setUpdating(true);
      
      await deleteDoc(doc(db, 'users', currentUser!.uid, 'paluwagans', paluwaganId!));
      
      toast.success('Paluwagan deleted successfully');
      navigate('/paluwagan');
    } catch (error) {
      console.error('Error deleting paluwagan:', error);
      toast.error('Failed to delete paluwagan');
      setUpdating(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg">Loading paluwagan details...</p>
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
              <Link to={`/paluwagan/${paluwaganId}`} className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                Edit Paluwagan
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
            
            {!canEditAll && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <p className="text-sm text-yellow-700">
                    Financial fields (start date, total numbers, amount per number, selected numbers) cannot be edited because payments have been made or payouts received. To modify these, all payments must be unpaid and payouts unreceived.
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Paluwagan Name
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
                    <label htmlFor="organizer" className="block text-sm font-medium text-gray-700">
                      Organizer
                    </label>
                    <input
                      type="text"
                      id="organizer"
                      value={formData.organizer}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizer: e.target.value }))}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                      readOnly={!canEditAll}
                      className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${!canEditAll ? 'bg-gray-100' : ''}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="totalNumbers" className="block text-sm font-medium text-gray-700">
                      Total Numbers
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="totalNumbers"
                        value={formData.totalNumbers}
                        onChange={(e) => setFormData(prev => ({ ...prev, totalNumbers: parseInt(e.target.value) }))}
                        required
                        min="1"
                        readOnly={!canEditAll}
                        className={`block w-full ${canEditAll ? 'pr-20' : 'pr-3'} border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${!canEditAll ? 'bg-gray-100' : ''}`}
                      />
                      {canEditAll && (
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, totalNumbers: Math.max(1, prev.totalNumbers - 1) }))}
                            className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, totalNumbers: prev.totalNumbers + 1 }))}
                            className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="amountPerNumber" className="block text-sm font-medium text-gray-700">
                      Amount Per Number (PHP)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="amountPerNumber"
                        value={formData.amountPerNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, amountPerNumber: parseFloat(e.target.value) }))}
                        required
                        min="1"
                        step="0.01"
                        readOnly={!canEditAll}
                        className={`block w-full ${canEditAll ? 'pr-20' : 'pr-3'} border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${!canEditAll ? 'bg-gray-100' : ''}`}
                      />
                      {canEditAll && (
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, amountPerNumber: Math.max(1, prev.amountPerNumber - 1) }))}
                            className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, amountPerNumber: prev.amountPerNumber + 1 }))}
                            className="h-full px-2 text-gray-500 hover:text-gray-700 border-l border-gray-300"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="payoutPerNumber" className="block text-sm font-medium text-gray-700">
                      Payout Per Number (PHP)
                    </label>
                    <input
                      type="number"
                      id="payoutPerNumber"
                      value={formData.payoutPerNumber}
                      readOnly
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-700 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Select Your Numbers (1 to {formData.totalNumbers})
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Selected numbers: {formData.selectedNumbers.sort((a, b) => a - b).join(', ')}
                  </p>
                  <div className="mt-3 grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {Array.from({ length: formData.totalNumbers }, (_, i) => i + 1).map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => handleNumberSelection(number)}
                        disabled={!canEditAll}
                        className={`py-2 px-3 text-center rounded-md text-sm font-medium ${
                          formData.selectedNumbers.includes(number)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        } ${!canEditAll ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                  <div>
                    {!deleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Paluwagan
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                        <button
                          type="button"
                          onClick={handleDeletePaluwagan}
                          disabled={updating}
                          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 w-full sm:w-auto"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(false)}
                          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={updating}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 w-full sm:w-auto"
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