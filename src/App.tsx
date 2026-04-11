import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Sports } from './pages/Sports';
import { SportDetail } from './pages/SportDetail';
import { Sleep } from './pages/Sleep';
import { Wellness } from './pages/Wellness';
import { AICoach } from './pages/AICoach';
import { TrainingPlans } from './pages/TrainingPlans';
import { PlanDetail } from './pages/PlanDetail';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useHealthKitSync } from './hooks/useHealthKitSync';
import { HealthKitSyncContext } from './context/HealthKitSyncContext';

function AuthenticatedLayout() {
  // Auto-sync HealthKit al abrir la app (solo iOS nativo, no-op en web)
  const syncState = useHealthKitSync();

  return (
    <HealthKitSyncContext.Provider value={syncState}>
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 lg:ml-48 ml-0 flex flex-col min-h-screen pb-16 lg:pb-0">
        <Header />
        <main className="flex-1 overflow-auto flex flex-col min-h-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sports" element={<Sports />} />
            <Route path="/sports/:category" element={<SportDetail />} />
            <Route path="/sleep" element={<Sleep />} />
            <Route path="/wellness" element={<Wellness />} />
            <Route path="/coach" element={<AICoach />} />
            <Route path="/training" element={<TrainingPlans />} />
            <Route path="/training/workout/:id" element={<ActiveWorkout />} />
            <Route path="/training/:id" element={<PlanDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
    </HealthKitSyncContext.Provider>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
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
