import Sidebar from '../components/Sidebar';
import { Clock } from 'lucide-react';

const Debt = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />

      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Debt Management</h2>
              </div>
            </div>
            
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="px-4 py-12 sm:px-6 text-center">
                <Clock className="mx-auto h-12 w-12 text-indigo-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">Coming Soon</h3>
                <p className="mt-2 text-gray-500 max-w-xl mx-auto">
                  We're currently building a powerful debt management system that will help you track:
                </p>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 max-w-2xl mx-auto">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-indigo-600">Money You Owe</h4>
                    <p className="mt-2 text-sm text-gray-500">Track your personal debts, payment schedules, and upcoming dues</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-indigo-600">Money Owed to You</h4>
                    <p className="mt-2 text-sm text-gray-500">Manage all the money others owe you, with due dates and reminders</p>
                  </div>
                </div>
                <p className="mt-8 text-sm text-gray-500">
                  Check back soon for this exciting new feature!
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Debt;