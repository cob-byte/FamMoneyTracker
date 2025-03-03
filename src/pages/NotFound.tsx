import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-24 h-24 bg-red-100 rounded-full mx-auto flex items-center justify-center">
          <span className="text-red-500 text-6xl font-bold">!</span>
        </div>
        
        <h1 className="mt-6 text-5xl font-extrabold text-gray-900">404</h1>
        <h2 className="mt-3 text-2xl font-bold text-gray-700">Page Not Found</h2>
        
        <p className="mt-4 text-gray-600">
          Oops! The page you are looking for doesn't exist or has been moved.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200"
          >
            <Home size={18} />
            <span>Go Home</span>
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
          >
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-sm text-gray-500">
        Eusebio Family Finance Tracker
      </p>
    </div>
  );
}