import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, Home, X, CreditCard, Clock, Users, DollarSign, Wallet } from 'lucide-react';

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      {/* Mobile Sidebar Toggle */}
      <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
        <button
          className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-gray-50 to-white shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform md:flex md:flex-col md:w-64 p-5`}>        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Wallet className="w-10 h-10 text-indigo-600 mr-3" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-indigo-700">Money Tracker</h1>
              <p className="text-sm font-medium text-gray-600">Eusebio Fam</p>
            </div>
          </div>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="mt-2 mb-6 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        
        <nav className="space-y-2">
          <Link to="/dashboard" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150">
            <Home className="w-5 h-5 mr-3 text-indigo-500" /> 
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link to="/transactions" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150">
            <Clock className="w-5 h-5 mr-3 text-indigo-500" /> 
            <span className="font-medium">Transactions</span>
          </Link>
          <Link to="/accounts" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150">
            <CreditCard className="w-5 h-5 mr-3 text-indigo-500" /> 
            <span className="font-medium">Accounts</span>
          </Link>
          <Link to="/paluwagan" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150">
            <Users className="w-5 h-5 mr-3 text-indigo-500" /> 
            <span className="font-medium">Paluwagan</span>
          </Link>
          <Link to="/debt" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150">
            <DollarSign className="w-5 h-5 mr-3 text-indigo-500" /> 
            <span className="font-medium">Debt</span>
          </Link>
        </nav>

        {/* Logout Button */}
        <div className="mt-auto pt-6 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors duration-150"
          >
            <LogOut className="w-5 h-5 mr-3" /> 
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;