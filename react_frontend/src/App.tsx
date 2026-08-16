import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './pages/DashboardLayout';
import ForecastingDashboard from './pages/ForecastingDashboard';
import InsightsDashboard from './pages/InsightsDashboard';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<ForecastingDashboard />} />
            <Route path="insights" element={<InsightsDashboard />} />
          </Route>
        </Routes>
    </BrowserRouter>
  );
}

export default App;
