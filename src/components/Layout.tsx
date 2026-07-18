import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ScrollManager />
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
