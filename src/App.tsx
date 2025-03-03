import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/Forgot';
import Dashboard from './pages/Dashboard';
import AccountSetup from './pages/AccountSetup';
import Transactions from './pages/Transactions';
import AddTransaction from './pages/AddTransaction';
import Accounts from './pages/Accounts'
import AddAccount from './pages/AddAccount';
import EditAccount from './pages/EditAccount';
import AccountDetail from './pages/AccountDetail';
import PaluwaganList from './pages/PaluwaganList';
import PaluwaganDetails from './pages/PaluwaganDetail';
import CreatePaluwagan from './pages/CreatePaluwagan';
import Debt from './pages/Debt';
import NotFound from './pages/NotFound';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/transactions" 
            element={
              <PrivateRoute>
                <Transactions />
              </PrivateRoute>
            }
          />
          <Route 
            path="/add-transaction" 
            element={
              <PrivateRoute>
                <AddTransaction />
              </PrivateRoute>
            }
          />
          <Route 
            path="/accounts" 
            element={
              <PrivateRoute>
                <Accounts />
              </PrivateRoute>
            }
          />
          <Route 
            path="/add-account" 
            element={
              <PrivateRoute>
                <AddAccount />
              </PrivateRoute>
            }
          />
          <Route 
            path="/edit-account/:accountId" 
            element={
              <PrivateRoute>
                <EditAccount />
              </PrivateRoute>
            }
          />
          <Route 
            path="/accounts/:accountId" 
            element={
              <PrivateRoute>
                <AccountDetail />
              </PrivateRoute>
            }
          />
          <Route 
            path="/account-setup" 
            element={
              <PrivateRoute>
                <AccountSetup />
              </PrivateRoute>
            }
          />
          <Route 
            path="/paluwagan" 
            element={
              <PrivateRoute>
                <PaluwaganList />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/paluwagan/:paluwaganId" 
            element={
              <PrivateRoute>
                <PaluwaganDetails />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/paluwagan/create" 
            element={
              <PrivateRoute>
                <CreatePaluwagan />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/debt" 
            element={
              <PrivateRoute>
                <Debt />
              </PrivateRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;