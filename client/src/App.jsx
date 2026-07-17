import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar        from './components/Sidebar';
import Navbar         from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { SocketProvider } from './context/SocketContext';
import Login          from './pages/Login';
import Register       from './pages/Register';
import AcceptInvite   from './pages/AcceptInvite';
import ResetPassword  from './pages/ResetPassword';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard      from './pages/Dashboard';
import Documents      from './pages/Documents';
import Chatbot        from './pages/Chatbot';
import Leads          from './pages/Leads';
import Settings       from './pages/Settings';
import Tickets        from './pages/Tickets';
import Knowledge      from './pages/Knowledge';
import Team           from './pages/Team';
import Analytics      from './pages/Analytics';
import Billing        from './pages/Billing';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        className: 'dark:bg-gray-800 dark:text-white',
        style: { borderRadius: '12px', fontSize: '14px' },
        success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
      }} />
      <Routes>
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite/:token"         element={<AcceptInvite />} />
        <Route path="/forgot-password"        element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<SocketProvider><AppLayout /></SocketProvider>}>
            <Route path="/app"                element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard"      element={<Dashboard />} />
            <Route path="/app/analytics"      element={<Analytics />} />
            <Route path="/app/chatbot"        element={<Chatbot />} />
            <Route path="/app/tickets"        element={<Tickets />} />
            <Route path="/app/leads"          element={<Leads />} />
            <Route path="/app/knowledge"      element={<Knowledge />} />
            <Route path="/app/documents"      element={<Documents />} />
            <Route path="/app/team"           element={<Team />} />
            <Route path="/app/billing"        element={<Billing />} />
            <Route path="/app/settings"       element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
