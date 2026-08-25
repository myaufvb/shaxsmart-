import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { HomeTab } from './pages/HomeTab';
import { CategoriesTab } from './pages/CategoriesTab';
import { CartTab } from './pages/CartTab';
import { AccountTab } from './pages/AccountTab';
import { SettingsTab } from './pages/SettingsTab';
import { ProductDetailsModal } from './pages/ProductDetailsModal';
import { InstantBuyModal } from './components/InstantBuyModal';
import { Product } from './types';

const MainAppContent: React.FC = () => {
  // Сохранение активной вкладки при выходе из приложения
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const savedTab = localStorage.getItem('shaxsmart_active_tab') as TabType;
    return savedTab && ['home', 'categories', 'cart', 'account', 'settings'].includes(savedTab) ? savedTab : 'home';
  });

  const {
    selectedProductForDetails,
    openProductDetails,
    closeProductDetails,
    instantBuyProduct,
    openInstantBuy,
    closeInstantBuy
  } = useCart();
  const { setOnNavigateToOrders } = useNotifications();

  useEffect(() => {
    localStorage.setItem('shaxsmart_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    setOnNavigateToOrders(() => {
      setActiveTab('account');
    });
  }, [setOnNavigateToOrders]);

  const handleProductSelect = (product: Product) => {
    openProductDetails(product);
  };

  const handleInstantBuyClick = (product: Product) => {
    closeProductDetails();
    openInstantBuy(product);
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden">
      {/* Tab Screen Content */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'home' && (
          <HomeTab
            onOpenCategories={() => setActiveTab('categories')}
            onOpenProductDetails={handleProductSelect}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesTab onOpenProductDetails={handleProductSelect} />
        )}

        {activeTab === 'cart' && (
          <CartTab
            onOpenHome={() => setActiveTab('home')}
            onOpenProductDetails={handleProductSelect}
          />
        )}

        {activeTab === 'account' && <AccountTab />}

        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Product Details Fullscreen Modal */}
      <ProductDetailsModal
        product={selectedProductForDetails}
        onClose={closeProductDetails}
        onInstantBuy={handleInstantBuyClick}
      />

      {/* 1-Click Buy Now Modal */}
      <InstantBuyModal
        product={instantBuyProduct}
        onClose={closeInstantBuy}
        onSuccess={() => {}}
      />

      {/* Bottom Navigation with 5 tabs */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <MainAppContent />
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
