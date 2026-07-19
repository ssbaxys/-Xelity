import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrefsProvider } from './context/PrefsContext';
import BanGuard from './components/BanGuard';
import MaintenanceGuard from './components/MaintenanceGuard';
import UpdateOverlay from './components/UpdateOverlay';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import InfoPage from './pages/InfoPage';
import NotFoundPage from './pages/NotFoundPage';
import PricingPage from './pages/PricingPage';
import SupportPage from './pages/SupportPage';
import BannedPage from './pages/BannedPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserCase from './pages/admin/AdminUserCase';
import AdminPayments from './pages/admin/AdminPayments';
import AdminChats from './pages/admin/AdminChats';
import AdminBroadcasts from './pages/admin/AdminBroadcasts';
import AdminModelPrompts from './pages/admin/AdminModelPrompts';
import AdminMaintenance from './pages/admin/AdminMaintenance';
import AdminTickets from './pages/admin/AdminTickets';

export default function App() {
  return (
    <PrefsProvider>
      <AuthProvider>
        <BrowserRouter>
          <UpdateOverlay />
          <MaintenanceGuard>
            <BanGuard>
              <Routes>
                <Route path="chat" element={<ChatPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="banned" element={<BannedPage />} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="users/:uid" element={<AdminUserCase />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="chats" element={<AdminChats />} />
                  <Route path="broadcasts" element={<AdminBroadcasts />} />
                  <Route path="prompts" element={<AdminModelPrompts />} />
                  <Route path="maintenance" element={<AdminMaintenance />} />
                  <Route path="tickets" element={<AdminTickets />} />
                </Route>
                <Route path="404" element={<NotFoundPage />} />
                <Route path=":slug" element={<InfoPage />} />
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Route>
              </Routes>
            </BanGuard>
          </MaintenanceGuard>
        </BrowserRouter>
      </AuthProvider>
    </PrefsProvider>
  );
}
