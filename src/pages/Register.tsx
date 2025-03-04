import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, Lock, AlertCircle, Check, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Password validation rules
  const hasMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordStrong = hasMinLength && hasUppercase && hasNumber;
  const passwordsMatch = password === confirmPassword && password !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!passwordsMatch) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    if (!isPasswordStrong) {
      setError('Password does not meet all requirements');
      toast.error('Password does not meet all requirements');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password);
      toast.success('Account created successfully! Please log in.');
      navigate('/login');
    } catch (error) {
      setError('Failed to create an account. Email may already be in use.');
      toast.error('Failed to create an account. Email may already be in use.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex flex-col md:flex-row">
      {/* Mobile Header - Visible only on mobile */}
      <div className="md:hidden w-full bg-white p-4 shadow-md flex flex-col items-center">
        <div className="w-20 h-20 rounded-full overflow-hidden mb-2">
          <img
            src="finance.jpg"
            alt="Financial management illustration"
            className="w-full h-full object-cover"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Master Your Money</h2>
        <p className="text-sm text-center text-gray-600 mt-1 px-4">
          Sign up to track your expenses, income, debts, and more—all in one place. Start building a stronger financial future today.
        </p>
      </div>

      {/* Registration Form Section - Left Side */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 order-2 md:order-1">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <UserPlus className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create Account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Start managing your finances today
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pl-10 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pl-10 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {!isPasswordStrong ? (
                <>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {hasMinLength ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="ml-2 text-xs text-gray-500">At least 6 characters</p>
                  </div>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {hasUppercase ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="ml-2 text-xs text-gray-500">Contains an uppercase letter</p>
                  </div>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {hasNumber ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="ml-2 text-xs text-gray-500">Contains a number</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center animate-fade-in">
                  <div className="flex-shrink-0">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="ml-2 text-xs text-gray-500">Password meets requirements</p>
                </div>
              )}
              {isPasswordStrong && (
                <div className="flex items-center animate-fade-in">
                  <div className="flex-shrink-0">
                    {passwordsMatch ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                  </div>
                  <p className="ml-2 text-xs text-gray-500">Passwords match</p>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : 'Sign up'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Visible on medium screens and above */}
      <div className="hidden md:flex md:w-1/2 bg-white flex-col items-center justify-center p-10 shadow-2xl z-10 order-1 md:order-2">
        <div className="w-80 h-80 rounded-full overflow-hidden shadow-lg">
          <img
            src="finance.jpg"
            alt="Financial management illustration"
            className="w-full h-full object-cover"
          />
        </div>
        <h2 className="mt-6 text-3xl font-bold text-gray-800 text-center">Master Your Money</h2>
        <p className="mt-4 text-center text-gray-600 max-w-sm leading-relaxed">
          Sign up to track your expenses, income, debts, and more—all in one place. Start building a stronger financial future today.
        </p>
      </div>
    </div>
  );
}