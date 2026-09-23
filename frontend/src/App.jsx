import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Gallery from './pages/Gallery.jsx';
import BookPage from './pages/BookPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  return token ? children : <Navigate to="/admin" replace />;
}

export default function App() {
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <BrandingProvider>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontFamily: "'Inter', sans-serif", fontSize: '0.9rem' } }} />
      <Routes>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />
        <Route path="/admin/dashboard/*" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/*" element={
          <>
            <Navbar scrolled={navScrolled} />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/book" element={<BookPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </>
        } />
      </Routes>
    </BrowserRouter>
    </BrandingProvider>
  );
}
