import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import BackendStatus from '@/components/BackendStatus';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Header />
      <main
        id="main-content"
        className="flex-1 pt-16 pb-24 md:pb-0"
        tabIndex={-1}
      >
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <BackendStatus />
    </div>
  );
};

export default Layout;
