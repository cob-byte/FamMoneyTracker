import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { Account } from '../types/account';


export default function EditAccount() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore();

  const accountTypes = [
    { id: 'cash', name: 'Cash' },
    { id: 'bank', name: 'Bank Account' },
    { id: 'credit', name: 'Credit Card' },
    { id: 'ewallet', name: 'E-Wallet' }
  ];

  useEffect(() => {
    async function fetchAccount() {
      if (!currentUser || !accountId) return;
      
      try {
        const accountDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
        const accountDoc = await getDoc(accountDocRef);
        
        if (!accountDoc.exists()) {
          setError('Account not found');
          setLoading(false);
          return;
        }
        
        const accountData = {
          id: accountDoc.id,
          ...accountDoc.data(),
          createdAt: accountDoc.data().createdAt?.toDate()
        } as Account;
        
        setAccount(accountData);
        setFormData({
          name: accountData.name,
          type: accountData.type,
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching account:', error);
        setError('Failed to load account details');
        setLoading(false);
      }
    }
    
    fetchAccount();
  }, [currentUser, db, accountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Account name is required');
      return;
    }
    
    if (!formData.type) {
      setError('Account type is required');
      return;
    }
    
    try {
      setUpdating(true);
      setError('');
      
      const accountDocRef = doc(db, 'users', currentUser!.uid, 'accounts', accountId!);
      
      await updateDoc(accountDocRef, {
        name: formData.name,
        type: formData.type,
      });
      
      toast.success('Account updated successfully');
      navigate(`/accounts/${accountId}`);
    } catch (error) {
      console.error('Error updating account:', error);
      setError('Failed to update account');
      setUpdating(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setUpdating(true);
      
      // Delete the account document
      await deleteDoc(doc(db, 'users', currentUser!.uid, 'accounts', accountId!));
      
      toast.success('Account deleted successfully');
      navigate('/accounts');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading account details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar/>
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="flex items-center mb-6">
              <Link to={`/accounts/${accountId}`} className="mr-2 text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                Edit Account
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
            
            {account && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Account Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="e.g. Main Bank Account"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                          Account Type
                        </label>
                        <select
                          id="type"
                          name="type"
                          value={formData.type}
                          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                          <option value="">Select an account type</option>
                          {accountTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Current Balance
                        </label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-300">
                          <p className="text-gray-700">
                            {account.balance?.toFixed(2) || '0.00'} <span className="text-sm text-gray-500">(Balance can only be changed through transactions)</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between pt-4">
                        <div>
                          {!deleteConfirm ? (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(true)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Account
                            </button>
                          ) : (
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={updating}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(false)}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-4 sm:mt-0">
                          <Link
                            to={`/accounts/${accountId}`}
                            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Cancel
                          </Link>
                          <button
                            type="submit"
                            disabled={updating}
                            className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {updating ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}