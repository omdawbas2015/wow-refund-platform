import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import Layout from './components/Layout';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/* ---------- Lazy-loaded pages ---------- */
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CaseList = lazy(() => import('./pages/CaseList'));
const CaseCreate = lazy(() => import('./pages/CaseCreate'));
const CaseDetails = lazy(() => import('./pages/CaseDetails'));
const PromoRequest = lazy(() => import('./pages/PromoRequest'));
const AdminPromo = lazy(() => import('./pages/AdminPromo'));
const Analytics = lazy(() => import('./pages/Analytics'));
const RefundOpsHub = lazy(() => import('./pages/RefundOpsHub'));
const RefundExecutionDashboard = lazy(() => import('./pages/RefundExecutionDashboard'));
const HelpDesk = lazy(() => import('./pages/HelpDesk'));
const AutomationEmails = lazy(() => import('./pages/AutomationEmails'));
const SystemPanel = lazy(() => import('./pages/system/SystemPanel'));

/* ---------- Loading fallback ---------- */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-tertiary)]" />
    </div>
  );
}

/* ---------- Query client ---------- */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/* ---------- Auth guard ---------- */
function PrivateRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* ---------- App ---------- */
export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              {/* Dashboard */}
              <Route index element={<Dashboard />} />

              {/* Refund Requests */}
              <Route path="cases" element={<CaseList />} />
              <Route path="cases/new" element={<CaseCreate />} />
              <Route path="cases/:id" element={<CaseDetails />} />

              {/* Refund Processing */}
              <Route path="refunds/execution" element={<RefundExecutionDashboard />} />
              <Route path="refunds/ops" element={<RefundOpsHub />} />

              {/* Compensation */}
              <Route path="compensation/issue" element={<PromoRequest />} />
              <Route path="compensation/internal" element={<PromoRequest />} />
              <Route path="compensation/inventory" element={<AdminPromo />} />

              {/* Analytics */}
              <Route path="analytics" element={<Analytics />} />

              {/* Help Desk */}
              <Route path="help-desk" element={<HelpDesk />} />
              <Route path="automation-emails" element={<AutomationEmails />} />

              {/* System Panel (unified admin) */}
              <Route path="system" element={<SystemPanel />} />

              {/* Legacy redirects — keep old URLs working */}
              <Route path="admin" element={<Navigate to="/system?tab=users" replace />} />
              <Route path="admin/refund-execution" element={<Navigate to="/refunds/execution" replace />} />
              <Route path="admin/refund-ops" element={<Navigate to="/refunds/ops" replace />} />
              <Route path="admin/enterprise-control" element={<Navigate to="/system" replace />} />
              <Route path="admin/audit" element={<Navigate to="/system?tab=audit" replace />} />
              <Route path="settings/*" element={<Navigate to="/system" replace />} />
              <Route path="automation/*" element={<Navigate to="/system?tab=automation" replace />} />
              <Route path="dashboard/promo" element={<Navigate to="/compensation/issue" replace />} />
              <Route path="dashboard/promo-internal" element={<Navigate to="/compensation/internal" replace />} />
              <Route path="promo/management" element={<Navigate to="/compensation/inventory" replace />} />
              <Route path="external/*" element={<Navigate to="/refunds/ops" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
