import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './pages/DashboardLayout';
import InsightsDashboard from './pages/InsightsDashboard';
import AdminPanel from './pages/AdminPanel';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

import MapDashboard from './pages/Map';
import ForecastingDashboard from './pages/ForecastingDashboard';

function App() {
  return (
    <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<MapDashboard />} />
            <Route path="store/:storeId" element={<ForecastingDashboard />} />
            <Route path="insights" element={<InsightsDashboard />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
        </Routes>
    </BrowserRouter>
  );
}

export default App;
