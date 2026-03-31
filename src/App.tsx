import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Sports } from './pages/Sports';
import { SportDetail } from './pages/SportDetail';
import { Sleep } from './pages/Sleep';
import { Wellness } from './pages/Wellness';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 lg:ml-48 ml-0 flex flex-col min-h-screen pb-16 lg:pb-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sports" element={<Sports />} />
            <Route path="/sports/:category" element={<SportDetail />} />
            <Route path="/sleep" element={<Sleep />} />
            <Route path="/wellness" element={<Wellness />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isDemoMode } = useAuth();

  if (!isAuthenticated && !isDemoMode) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
