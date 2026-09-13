import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { AlertCircle, Bell, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Crown, Gem, LayoutDashboard, LogOut, Menu, Moon, Package, Palette, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Sun, TrendingUp, UsersRound, BarChart3, Maximize, X } from 'lucide-react'
import Masonry from 'react-masonry-css'
import { formatDateTimeDDMMYY, boutiqueThemes, appearanceTokens, navItems, stats, orders, products, staffActivities } from '../utils/constants'
const CreateUserPage = lazy(() => import('../pages/Users/CreateUser'))
const ViewUsersPage = lazy(() => import('../pages/Users/ViewUsers'))
const AddClientsPage = lazy(() => import('../pages/Clients/AddClients'))
const ViewClientsPage = lazy(() => import('../pages/Clients/ViewClients'))
const ClientDetailPage = lazy(() => import('../pages/Clients/ClientDetail'))
const AddOrderPage = lazy(() => import('../pages/Orders/AddOrder'))
const ViewOrdersPage = lazy(() => import('../pages/Orders/ViewOrders'))
const CreateInventoryPage = lazy(() => import('../pages/Inventory/CreateInventory'))
const ViewInventoryPage = lazy(() => import('../pages/Inventory/ViewInventory'))
const InventoryDetailPage = lazy(() => import('../pages/Inventory/InventoryDetail'))
const CreateSalesPage = lazy(() => import('../pages/Sales/CreateSales'))
const ViewSalesPage = lazy(() => import('../pages/Sales/ViewSales'))
const ReportsPage = lazy(() => import('../pages/Reports/Reports'))
const AddIncomePage = lazy(() => import('../pages/Accounts/AddIncome'))
const AddExpensePage = lazy(() => import('../pages/Accounts/AddExpense'))
const ViewAccountsPage = lazy(() => import('../pages/Accounts/ViewAccounts'))
const StaffManagementPage = lazy(() => import('../pages/Accounts/StaffManagement'))
const CreateDesignPage = lazy(() => import('../pages/Bridal/CreateDesign'))
const DesignLibraryPage = lazy(() => import('../pages/Bridal/DesignLibrary'))
import AccountDetailsModal from './AccountDetailsModal'

import supabase from '../supabase'

function Dashboard({
  isAuthLoading,
  onLogout, user, goBack,
  currentPage, setCurrentPage,
  appearance, setAppearance,
  themeName, setThemeName,
  users, setUsers,
  designations, setDesignations,
  clients, setClients,
  orders, setOrders,
  inventory, setInventory,
  sales, setSales,
  activities, setActivities,
  orderTypes, setOrderTypes,
  productTypes, setProductTypes,
  inventoryUnits, setInventoryUnits,
  incomeCategories, setIncomeCategories,
  expenseCategories, setExpenseCategories,
  orderLimits, setOrderLimits,
  cloudLoaded,
  syncError,
  saveSale, saveOrder, saveClient, saveUser, deleteClient, deleteOrder, saveConfig, saveActivity, saveInventory,
  selectedClient, setSelectedClient, clientDetailMode, setClientDetailMode,
  staffList, setStaffList,
  themeStyle
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_sidebar_collapsed');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load sidebar state', e);
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('erp_sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const [globalToast, setGlobalToast] = useState(null)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const [notificationsPage, setNotificationsPage] = useState(1)
  const notificationsPerPage = 10

  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY < 60) {
            setIsHeaderVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY - lastScrollY > 5) {
            setIsHeaderVisible(false); // scrolling down
          } else if (currentScrollY < lastScrollY && lastScrollY - currentScrollY > 5) {
            setIsHeaderVisible(true); // scrolling up
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [dashboardCards, setDashboardCards] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_dashboard_cards_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Dashboard Layout Load Error:", e);
    }
    return [
      { id: 'Hero', label: 'Welcome Banner', visible: true, span: 2 },
      { id: 'Stats', label: 'Quick Stats', visible: true, span: 2 },
      { id: 'Orders', label: 'Production Queue', visible: true, span: 1 },
      { id: 'Sales', label: 'Recent Transactions', visible: true, span: 1 },
      { id: 'Team', label: 'Staff Activity', visible: true, adminOnly: true, span: 1 },
      { id: 'Revenue', label: 'Income Analytics', visible: true, adminOnly: true, span: 1 },
      { id: 'Calendar', label: 'Delivery Tracker', visible: true, span: 1 },
      { id: 'Elegance', label: 'Client Performance', visible: true, span: 1 }
    ];
  });

  useEffect(() => {
    localStorage.setItem('erp_dashboard_cards_v2', JSON.stringify(dashboardCards));
  }, [dashboardCards]);

  const [draggedCardId, setDraggedCardId] = useState(null);

  const handleCardMove = (draggedId, targetId) => {
    const newCards = [...dashboardCards];
    const draggedIdx = newCards.findIndex(c => c.id === draggedId);
    const targetIdx = newCards.findIndex(c => c.id === targetId);
    const [movedCard] = newCards.splice(draggedIdx, 1);
    newCards.splice(targetIdx, 0, movedCard);
    setDashboardCards(newCards);
  };

  const toggleCardVisibility = (id, visible) => {
    setDashboardCards(prev => prev.map(c => c.id === id ? { ...c, visible } : c));
    if (showGlobalToast) {
      showGlobalToast(visible ? 'Card Added' : 'Card Removed', `${dashboardCards.find(c => c.id === id).label} has been ${visible ? 'restored' : 'hidden'}.`);
    }
  };

  const cycleCardSize = (id) => {
    setDashboardCards(prev => prev.map(c => {
      if (c.id === id) {
        let col = c.colSpan || c.span || 1;
        let row = c.rowSpan || 1;

        if (col === 1 && row === 1) { col = 2; row = 1; }
        else if (col === 2 && row === 1) { col = 1; row = 2; }
        else if (col === 1 && row === 2) { col = 2; row = 2; }
        else { col = 1; row = 1; }
        
        return { ...c, colSpan: col, rowSpan: row, span: col };
      }
      return c;
    }));
  };

  const [showManageMenu, setShowManageMenu] = useState(false);

  const [screenSize, setScreenSize] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const isDesktop = screenSize >= 1024;

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const showGlobalToast = (title, message) => {
    setGlobalToast({ title, message })
    setTimeout(() => setGlobalToast(null), 4000)

    const newActivity = {
      id: Date.now(),
      title,
      description: message,
      timestamp: new Date().toISOString(),
      actor: user?.name || 'Admin'
    }
    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 500)
      return updated
    })
    if (saveActivity) saveActivity(newActivity)
  }
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false)
  const [expandedSubmenu, setExpandedSubmenu] = useState(null)
  const [flyoutMenu, setFlyoutMenu] = useState(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const searchRef = useRef(null)

  const [highlightOrderId, setHighlightOrderId] = useState(null)
  const [highlightSaleId, setHighlightSaleId] = useState(null)
  const [highlightInventoryId, setHighlightInventoryId] = useState(null)
  const [highlightClientId, setHighlightClientId] = useState(null)
  const [highlightStaffId, setHighlightStaffId] = useState(null)
  const [highlightAccountId, setHighlightAccountId] = useState(null)
  const [editingDesign, setEditingDesign] = useState(null)

  useEffect(() => {
    const handleGlobalNav = (e) => {
      const { type, id } = e.detail;
      if (type === 'order') {
        setCurrentPage('view-orders');
        setHighlightOrderId(id);
      }
    };
    window.addEventListener('erp-global-nav', handleGlobalNav);
    
    // Check URL for direct order links from Push Notifications
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('openOrder');
    if (orderId) {
      setCurrentPage('view-orders');
      setHighlightOrderId(orderId);
      // Clean up URL so a refresh doesn't trigger it again
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => window.removeEventListener('erp-global-nav', handleGlobalNav);
  }, [setCurrentPage]);

  const [allAccounts, setAllAccounts] = useState([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const migrationRunRef = useRef(false)
  
  const fetchAllAccountsData = () => {
    if (user?.role === 'Admin' || user?.role === 'Owner') {
      supabase.from('erp_accounts').select('*')
        .then(({ data, error }) => {
          if (error) {
            console.warn("Accounts fetch warning:", error.message);
            return;
          }
          if (data) {
            setAllAccounts(data)
            setAccountsLoaded(true)
          }
        })
        .catch(err => console.warn("Accounts fetch failed:", err))
    }
  }

  useEffect(() => {
    if (migrationRunRef.current || !accountsLoaded || !cloudLoaded || !(user?.role === 'Admin' || user?.role === 'Owner') || (sales.length === 0 && orders.length === 0)) return;
    
    migrationRunRef.current = true;
    const syncMissingData = async () => {
      let needsRefresh = false;
      const existingSaleReferences = new Set(allAccounts.filter(a => a.type === 'Income' && a.reference && a.reference.startsWith('Sale #')).map(a => a.reference));
      const existingAdvanceReferences = new Set(allAccounts.filter(a => a.type === 'Income' && a.reference && a.reference.startsWith('Order Advance #')).map(a => a.reference));
      
      for (const sale of sales) {
        const total = parseFloat(sale.total) || 0;
        if (total <= 0) continue;
        
        const saleIdRef = `Sale #${sale.saleId || sale.id}`;
        if (!existingSaleReferences.has(saleIdRef)) {
          const saleDate = sale.timestamp ? sale.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
          const clientName = sale.client?.name || sale.client || 'Unknown Client';
          const paymentMode = sale.paymentMode || 'Cash';
          
          try {
            await supabase.from('erp_accounts').insert([{
              type: 'Income',
              date: saleDate,
              category: 'Sales',
              amount: total,
              payment_mode: paymentMode,
              reference: saleIdRef,
              notes: `Auto-migrated from past sale for ${clientName}`
            }]);
            needsRefresh = true;
          } catch (err) {
            console.error("Migration auto-insert failed", err);
          }
        }
      }

      for (const order of orders) {
        const advance = parseFloat(order.advance) || 0;
        if (advance <= 0) continue;
        
        const orderIdRef = `Order Advance #${order.orderId || order.id}`;
        if (!existingAdvanceReferences.has(orderIdRef)) {
          const orderDate = order.orderDate || new Date().toISOString().split('T')[0];
          const clientName = order.clientName || order.client || 'Unknown Client';
          
          try {
            await supabase.from('erp_accounts').insert([{
              type: 'Income',
              date: orderDate,
              category: 'Order Advance',
              amount: advance,
              payment_mode: 'Cash',
              reference: orderIdRef,
              notes: `Auto-migrated advance for ${clientName}`
            }]);
            needsRefresh = true;
          } catch (err) {
            console.error("Migration auto-insert failed for order", err);
          }
        }
      }

      if (needsRefresh) fetchAllAccountsData();
    };
    syncMissingData();
  }, [cloudLoaded, accountsLoaded, user?.role, sales, orders, allAccounts]);

  useEffect(() => {
    fetchAllAccountsData();

    const channel = supabase.channel('erp_accounts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_accounts' }, () => {
        fetchAllAccountsData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.role])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsGlobalSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!flyoutMenu) return;
    const handleClose = (e) => {
      if (e && e.type === 'mousedown' && e.target && e.target.closest && e.target.closest('#flyout-menu')) {
        return;
      }
      setFlyoutMenu(null);
    };
    // Add a slight delay so the current event doesn't trigger immediate closure
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClose);
      document.addEventListener('wheel', handleClose, { passive: true });
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('wheel', handleClose);
    };
  }, [flyoutMenu]);

  // Auto scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // SHARED FUNCTIONS

  // SAVE TO SUPABASE (BULK & CONFIG)
  useEffect(() => {
    if (!cloudLoaded) return;

    const saveToSupabase = async () => {
      try {
        const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === "" ? undefined : v));
        await Promise.all([
          // Save Config settings
          supabase.from('erp_config').upsert([{ id: 'designations', data: clean(designations) }]),
          supabase.from('erp_config').upsert([{ id: 'orderTypes', data: clean(orderTypes) }]),
          supabase.from('erp_config').upsert([{ id: 'productTypes', data: clean(productTypes) }]),
          supabase.from('erp_config').upsert([{ id: 'inventoryUnits', data: clean(inventoryUnits) }]),
          // Save Users & Inventory in bulk/background
          ...users.map(u => supabase.from('erp_users').upsert([{ id: u.email, data: clean(u) }])),
          ...inventory.slice(0, 200).map(i => supabase.from('erp_inventory').upsert([{ id: (i.id || i.productId).toString(), data: clean(i) }]))
        ]);
      } catch (error) {
        console.error("Supabase Background Sync Error:", error.message);
      }
    };

    const timer = setTimeout(saveToSupabase, 5000); // Debounce saves
    return () => clearTimeout(timer);
  }, [users, inventory, designations, orderTypes, productTypes, inventoryUnits, cloudLoaded]);

  const activeSidebarPage = currentPage === 'client-detail' ? 'view-clients' : (currentPage === 'inventory-detail' ? 'view-inventory' : currentPage)

  useEffect(() => {
    localStorage.setItem('erp_current_page', currentPage)

    // Auto-expand submenu if current page belongs to it
    navItems.forEach(item => {
      if (item.hasSubmenu && item.submenu.some(sub => sub.id === activeSidebarPage)) {
        setExpandedSubmenu(item.label)
      }
    })
  }, [currentPage, activeSidebarPage])

  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null)
  const [inventoryDetailMode, setInventoryDetailMode] = useState('view')
  const sidebarWidth = isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72'
  const transitionClass = 'transition-all duration-300 ease-in-out'

  const loggedInUserInList = users.find(u => (u.id || u.email) === (user?.id || user?.email))
  const currentUserName = loggedInUserInList ? loggedInUserInList.name : (user?.name || 'User')
  const currentUserEmail = loggedInUserInList ? loggedInUserInList.email : (user?.email || 'admin@malka.com')

  // Live Data Calculations
  const allOrders = orders
  const allClients = clients
  const allInventory = inventory
  const allSales = sales

  const liveStats = [
    { label: 'Total Revenue', value: `₹${allSales.reduce((acc, s) => acc + (parseFloat(s.total) || parseFloat(s.totalAmount) || parseFloat(s.paidAmount) || 0), 0).toLocaleString()}`, note: 'Real-time sales', icon: TrendingUp, adminOnly: true, link: 'view-sales' },
    { label: 'Active Orders', value: allOrders.filter(o => o.status !== 'Closed' && o.status !== 'Sold' && o.status !== 'Completed').length, note: 'In production', icon: ShoppingBag, link: 'view-orders' },
    { label: 'Studio Clients', value: allClients.length, note: 'Registered profiles', icon: UsersRound, link: 'view-clients' },
    { label: 'Stock Items', value: allInventory.length, note: 'Inventory items', icon: Package, link: 'view-inventory' },
  ].filter(s => !s.adminOnly || user?.role === 'Admin')

  const liveRecentOrders = [...allOrders].sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0)).slice(0, 5)
  const liveRecentSales = [...allSales].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 5)
  const liveRecentProducts = [...allInventory].reverse().slice(0, 3)
  const liveActivities = activities.slice(0, 4)

  // Revenue Pulse Calculation
  const categoryRevenue = allSales.reduce((acc, s) => {
    (s.items || []).forEach(item => {
      const pName = (item.productName || '').toLowerCase();
      const pType = (item.productType || '').toLowerCase();
      let cat = 'Luxury pret'; // Default
      if (pName.includes('bridal') || pType.includes('bridal') || pName.includes('lehenga')) cat = 'Bridal wear';
      else if (pName.includes('alteration') || pType.includes('alteration') || pName.includes('repair')) cat = 'Alterations';

      const itemPrice = parseFloat(item.price || 0);
      const itemQty = parseFloat(item.qty || 1);
      const itemDisc = parseFloat(item.discount || 0);
      const itemTotal = (itemPrice * itemQty) * (1 - itemDisc / 100);

      acc[cat] = (acc[cat] || 0) + itemTotal;
    });
    return acc;
  }, {});

  const totalRev = Object.values(categoryRevenue).reduce((a, b) => a + b, 0);
  const liveRevenuePulse = [
    { label: 'Bridal wear', value: categoryRevenue['Bridal wear'] || 0, color: 'bg-[var(--accent)]' },
    { label: 'Luxury pret', value: categoryRevenue['Luxury pret'] || 0, color: 'bg-[var(--jewel)]' },
    { label: 'Alterations', value: categoryRevenue['Alterations'] || 0, color: 'bg-[var(--gold)]' },
  ].map(item => ({
    ...item,
    percentage: totalRev > 0 ? Math.round((item.value / totalRev) * 100) : 0
  }));

  // Global Search Logic
  const searchResults = React.useMemo(() => {
    if (!globalSearch.trim()) return { clients: [], orders: [], inventory: [], sales: [], pages: [], users: [], staffPayroll: [], accounts: [] }
    const q = globalSearch.toLowerCase()
    const isAdmin = user?.role === 'Admin'

    const matchedPages = navItems.reduce((acc, item) => {
      if (item.hasSubmenu) {
        acc.push(...item.submenu.filter(sub => sub.label.toLowerCase().includes(q) || sub.id.toLowerCase().includes(q)).map(sub => ({ id: sub.id, label: sub.label, icon: item.icon })))
      } else {
        if (item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)) {
          acc.push({ id: item.id, label: item.label, icon: item.icon })
        }
      }
      return acc;
    }, []).slice(0, 3)

    return {
      clients: allClients.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 4),
      orders: allOrders.filter(o => o.clientName?.toLowerCase().includes(q) || o.product?.toLowerCase().includes(q) || o.id?.toString().includes(q)).slice(0, 4),
      inventory: isAdmin ? allInventory.filter(p => p.productName?.toLowerCase().includes(q) || p.productId?.toLowerCase().includes(q)).slice(0, 4) : [],
      sales: isAdmin ? allSales.filter(s => s.saleId?.toLowerCase().includes(q) || s.client?.name?.toLowerCase().includes(q)).slice(0, 4) : [],
      pages: matchedPages,
      users: isAdmin ? users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)).slice(0, 3) : [],
      staffPayroll: isAdmin ? (staffList || []).filter(s => s.name?.toLowerCase().includes(q) || s.designation?.toLowerCase().includes(q) || s.phone?.includes(q)).slice(0, 3) : [],
      accounts: isAdmin ? allAccounts.filter(a => a.partyName?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)).slice(0, 4) : []
    }
  }, [globalSearch, allClients, allOrders, allInventory, allSales, user?.role, navItems, users, staffList, allAccounts])
  const hasSearchResults = Object.values(searchResults).some(arr => arr.length > 0)

  // Smart Delivery Calendar Logic
  const deliveryStats = React.useMemo(() => {
    const counts = {};
    orders.filter(o => o.status !== 'Sold' && o.status !== 'Closed' && o.status !== 'Completed').forEach(o => {
      if (o.deliveryDate) {
        counts[o.deliveryDate] = (counts[o.deliveryDate] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const generateCalendarDays = () => {
    const days = [];
    const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const end = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);

    // Pad beginning
    for (let i = 0; i < start.getDay(); i++) {
      days.push({ day: null });
    }

    for (let d = 1; d <= end.getDate(); d++) {
      const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const limit = orderLimits?.[dateStr] !== undefined ? orderLimits[dateStr] : (orderLimits?.global || 999);
      days.push({ day: d, date: dateStr, count: deliveryStats[dateStr] || 0, limit });
    }
    return days;
  };

  const getCardSpan = (card) => {
    const cols = screenSize >= 1024 ? 2 : 1;

    let colSpan = card.colSpan || card.span;
    let rowSpan = card.rowSpan || 1;

    if (!colSpan) {
      switch (card.id) {
        case 'Hero': colSpan = 2; break;
        case 'Stats': colSpan = 2; break;
        case 'Elegance': colSpan = 2; break;
        default: colSpan = 1; break;
      }
    }

    const rowClass = rowSpan > 1 ? `row-span-${rowSpan}` : '';
    
    if (cols === 1) return `span-full ${rowClass}`.trim();

    return `${colSpan === 2 ? 'span-full' : 'span-1'} ${rowClass}`.trim();
  };

  const renderDashboardCard = (card, idx) => (
                    <div
                      key={card.id}
                      draggable={isDesktop}
                      onDragStart={() => setDraggedCardId(card.id)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={() => {
                        if (draggedCardId && draggedCardId !== card.id) handleCardMove(draggedCardId, card.id);
                        setDraggedCardId(null);
                      }}
                      className={`group/card animate-in-card transition-all duration-300 ${getCardSpan(card)} ${draggedCardId === card.id ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      {/* Drag Handle & Close Button Overlay */}
                      <div className="absolute right-4 top-4 z-10 hidden md:flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <button
                          onClick={() => cycleCardSize(card.id)}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--surface-strong)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] shadow-sm transition-all"
                          title="Resize card"
                        >
                          <Maximize size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Resize</span>
                        </button>
                        <div className="cursor-move flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--surface-strong)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] shadow-sm" title="Drag to reorder">
                          <Menu size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Drag</span>
                        </div>
                        <button
                          onClick={() => toggleCardVisibility(card.id, false)}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white shadow-sm transition-all"
                          title="Close card"
                        >
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Close</span>
                        </button>
                      </div>

                      {card.id === 'Hero' && (
                        <section className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--jewel)] text-white shadow-[var(--shadow)]">
                          <div className="grid gap-6 bg-[var(--hero)] p-6 md:grid-cols-[1fr_320px] lg:p-8">
                            <div>
                              <p className="flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-[#f8e6dc]">
                                <Palette size={16} /> Spring bridal collection is live
                              </p>
                              <h2 className="mt-5 max-w-2xl text-h1 font-semibold leading-tight lg:text-5xl">
                                Boutique operations with fittings, fabrics, and client moments in one view.
                              </h2>
                              <div className="mt-6 flex flex-wrap gap-3">
                                {['42 priority orders', '18 fittings today', '96% delivery score'].map((item) => (
                                  <span className="rounded-xl border border-white/10 bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur" key={item}>
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {user?.role === 'Admin' && (
                              <div className="rounded-2xl border border-white/15 bg-white/12 p-5 backdrop-blur">
                                <p className="flex items-center gap-2 text-sm text-[#f8e6dc]">
                                  <TrendingUp size={16} /> Revenue pulse
                                </p>
                                <p className="mt-3 text-h1 font-semibold">₹{allSales.reduce((acc, s) => acc + (parseFloat(s.totalAmount) || 0), 0).toLocaleString()}</p>
                                <div className="mt-5 space-y-3">
                                  {liveRevenuePulse.slice(0, 3).map((item, index) => (
                                    <div key={item.label}>
                                      <div className="mb-1 flex justify-between text-xs text-[#f8e6dc]">
                                        <span>{item.label}</span>
                                        <span>{item.percentage}%</span>
                                      </div>
                                      <div className="h-2 rounded-full bg-white/15">
                                        <div className="h-2 rounded-full bg-[#f4ded2]" style={{ width: `${item.percentage}%` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </section>
                      )}

                      {card.id === 'Stats' && (
                        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          {(isAuthLoading || !cloudLoaded) ? (
                            // Skeleton Stats
                            [1, 2, 3, 4].map((i) => (
                              <div key={i} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
                                <div className="mb-5 flex items-center justify-between">
                                  <div className="skeleton w-11 h-11 rounded-xl" />
                                  <div className="skeleton w-12 h-5 rounded-full" />
                                </div>
                                <div className="skeleton skeleton-text w-1/2" />
                                <div className="skeleton skeleton-text w-3/4 h-8 mt-3" />
                                <div className="skeleton skeleton-text w-1/3 mt-2" />
                              </div>
                            ))
                          ) : (
                            liveStats.map((stat) => {
                              const Icon = stat.icon
                              return (
                                <article key={stat.label} onClick={() => stat.link && setCurrentPage(stat.link)} className={`rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur transition hover:-translate-y-0.5 ${stat.link ? 'cursor-pointer hover:border-[var(--accent)] hover:shadow-md' : ''}`}>
                                  <div className="mb-5 flex items-center justify-between">
                                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                                      <Icon size={21} />
                                    </span>
                                    <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--jewel)]">
                                      Live
                                    </span>
                                  </div>
                                  <p className="text-tiny">{stat.label}</p>
                                  <h3 className="text-h1 mt-3">{stat.value}</h3>
                                  <p className="text-para-sm mt-2 text-[var(--jewel)] font-medium">{stat.note}</p>
                                </article>
                              )
                            })
                          )}
                        </section>
                      )}

                      {card.id === 'AIRules' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
                          <div className="mb-5 flex items-center justify-between">
                            <div>
                              <h2 className="text-h2 flex items-center gap-2">
                                <Sparkles size={20} className="text-[var(--jewel)]" /> AI Capacity Rules
                              </h2>
                              <p className="text-para text-[var(--muted)]">Active production limits set by AI</p>
                            </div>
                            <button
                              onClick={() => setCurrentPage('view-orders')}
                              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold hover:bg-[var(--soft)] transition"
                            >
                              Manage
                            </button>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-2xl bg-[var(--soft)] p-4 border border-[var(--border)]">
                              <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Global Default</p>
                              <p className="text-2xl font-black text-[var(--text)] mt-1">{orderLimits.global || 6} <span className="text-xs font-medium text-[var(--muted)]">orders/day</span></p>
                            </div>
                            {Object.entries(orderLimits).filter(([k]) => k !== 'global').map(([date, limit]) => (
                              <div key={date} className="rounded-2xl bg-[var(--accent-soft)] p-4 border border-[var(--accent)]">
                                <p className="text-[10px] font-bold uppercase text-[var(--accent)]">Scheduled Limit</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xl font-black text-[var(--text)]">{limit} <span className="text-xs font-medium text-[var(--muted)]">orders</span></p>
                                  <span className="text-xs font-bold bg-[var(--surface)] px-2 py-0.5 rounded-lg border border-[var(--border)]">{date}</span>
                                </div>
                              </div>
                            ))}
                            {Object.keys(orderLimits).length <= 1 && (
                              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] p-4 text-center">
                                <p className="text-xs font-medium text-[var(--muted)]">No active AI date overrides. All days are set to {orderLimits.global || 6}.</p>
                              </div>
                            )}
                          </div>
                        </section>
                      )}

                      {card.id === 'Calendar' && (
                        <section className="relative rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
                          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <h2 className="text-h2 flex items-center gap-2">
                                <Bell size={20} className="text-[var(--accent)]" /> Smart Delivery Tracker
                              </h2>
                              <p className="text-para text-[var(--muted)]">Monitor daily production output</p>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-1">
                              <button
                                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                                className="p-2 hover:bg-[var(--soft)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)]"
                              >
                                <ChevronsLeft size={16} />
                              </button>
                              <span className="px-4 text-sm font-bold min-w-[140px] text-center">
                                {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                              </span>
                              <button
                                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                                className="p-2 hover:bg-[var(--soft)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)]"
                              >
                                <ChevronsRight size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                              <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--muted)] py-2">{d}</div>
                            ))}
                            {generateCalendarDays().map((d, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (d.day && d.count > 0) {
                                    setSelectedCalendarDate(d.date);
                                  }
                                }}
                                disabled={!d.day || d.count === 0}
                                className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all ${!d.day ? 'bg-transparent border-transparent' : d.count >= d.limit ? 'bg-red-500/10 border-red-500 shadow-sm cursor-pointer hover:brightness-95' : d.count >= d.limit * 0.8 ? 'bg-orange-500/10 border-orange-500 shadow-sm cursor-pointer hover:brightness-95' : d.count > 0 ? 'bg-green-500/10 border-green-500 shadow-sm cursor-pointer hover:brightness-95' : 'bg-[var(--surface-strong)] border-[var(--border)] cursor-default'}`}
                              >
                                {d.day && (
                                  <>
                                    <span className={`text-xs font-bold ${d.count >= d.limit ? 'text-red-500' : d.count >= d.limit * 0.8 ? 'text-orange-500' : d.count > 0 ? 'text-green-500' : 'text-[var(--text)]'}`}>{d.day}</span>
                                    {(d.count > 0 || d.limit < 999) && (
                                      <div className={`mt-1 flex items-center justify-center px-1.5 h-5 min-w-[20px] rounded-full text-white text-[10px] font-black shadow-lg ${d.count > 0 ? 'animate-pulse' : ''} ${d.count >= d.limit ? 'bg-red-500' : d.count >= d.limit * 0.8 ? 'bg-orange-500' : d.count > 0 ? 'bg-green-500' : 'bg-[var(--muted)]'}`}>
                                        {d.limit < 999 ? `${d.count}/${d.limit}` : d.count}
                                      </div>
                                    )}
                                    {d.date === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` && (
                                      <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 shadow-sm" />
                                    )}
                                  </>
                                )}
                              </button>
                            ))}
                          </div>

                          {selectedCalendarDate && (
                              <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200 rounded-[24px]">
                                <div className="w-full max-w-md max-h-full rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                                  <div className="flex justify-between items-center mb-5 pb-4 border-b border-[var(--border)]">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                                        <Bell size={20} />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-[var(--text)] text-lg">Deliveries</h3>
                                        <p className="text-xs font-medium text-[var(--muted)]">{new Date(selectedCalendarDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                      </div>
                                    </div>
                                    <button onClick={() => setSelectedCalendarDate(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)] transition-colors">
                                      <X size={18} />
                                    </button>
                                  </div>
                                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                                  {orders.filter(o => o.deliveryDate === selectedCalendarDate && o.status !== 'Sold' && o.status !== 'Closed' && o.status !== 'Completed').map((o, idx) => (
                                    <button
                                      key={o.id || idx}
                                      className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 hover:border-[var(--accent)] transition flex items-center justify-between group"
                                      onClick={() => {
                                        setHighlightOrderId(o.id)
                                        setCurrentPage('view-orders')
                                        setSelectedCalendarDate(null)
                                      }}
                                    >
                                      <div>
                                        <p className="font-bold text-[var(--text)] group-hover:text-[var(--accent)]">{o.clientName}</p>
                                        <p className="text-xs text-[var(--muted)]">{o.product}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-1 rounded-lg">{o.status}</p>
                                        <p className="text-[10px] text-[var(--muted)] mt-1">#{o.id}</p>
                                      </div>
                                    </button>
                                  ))}
                                  </div>
                                  <div className="mt-6 pt-4 flex justify-end border-t border-[var(--border)]">
                                    <button
                                      onClick={() => setSelectedCalendarDate(null)}
                                      className="bg-[var(--surface)] border border-[var(--border)] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--soft)] hover:text-[var(--accent)] transition-all"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-[var(--muted)] font-medium">
                              <div className="h-3 w-3 rounded-md bg-[var(--surface-strong)] border border-[var(--border)]" /> None
                            </div>
                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 font-medium">
                              <div className="h-3 w-3 rounded-md bg-green-500/20 border border-green-500" /> 1-4 Deliveries
                            </div>
                            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-500 font-semibold">
                              <div className="h-3 w-3 rounded-md bg-orange-500/20 border border-orange-500" /> 5-9 Deliveries
                            </div>
                            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 font-bold">
                              <div className="h-3 w-3 rounded-md bg-red-500/20 border border-red-500" /> 10+ Deliveries
                            </div>
                          </div>
                        </section>
                      )}

                      {card.id === 'Orders' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
                          <div className="mb-5 flex items-center justify-between">
                            <div>
                              <h2 className="text-h2">Live boutique orders</h2>
                              <p className="text-para text-[var(--muted)]">Production queue for this week</p>
                            </div>
                            <button
                              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold hover:bg-[var(--soft)] transition"
                              type="button"
                              onClick={() => setCurrentPage('view-orders')}
                            >
                              View all
                            </button>
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                            {liveRecentOrders.map((o) => (
                              <div className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[1fr_1fr_150px_90px]" key={o.id}>
                                <span className="font-semibold">{o.clientName}</span>
                                <span className="text-[var(--muted)]">{o.product}</span>
                                <span className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)] max-h-[26px]">{o.status}</span>
                                <span className="font-semibold md:text-right">{o.price}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {card.id === 'Team' && user?.role === 'Admin' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--jewel)] p-5 text-white shadow-[var(--shadow)]">
                          <h2 className="text-h2 flex items-center gap-2">
                            <ShieldCheck size={20} /> Team pulse
                          </h2>
                          <p className="text-para-sm mt-1 text-[#cce0da]">Staff activities today</p>
                          <div className="mt-5 space-y-3">
                            {liveActivities.map((act) => (
                              <div className="rounded-md bg-white/10 p-4" key={act.id}>
                                <p className="text-sm text-[#cce0da]">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="font-semibold">{act.title}</p>
                                <p className="text-sm text-[#cce0da] mt-1">{act.description}</p>
                                <p className="text-sm text-[#dfeee9] mt-2 font-medium">By {act.actor || 'System'}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {card.id === 'Sales' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
                          <div className="mb-5 flex items-center justify-between">
                            <div>
                              <h2 className="text-h2">Real-time sales</h2>
                              <p className="text-para text-[var(--muted)]">Recent transactions</p>
                            </div>
                            {user?.role === 'Admin' && (
                              <button
                                className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold hover:bg-[var(--soft)] transition"
                                type="button"
                                onClick={() => setCurrentPage('view-sales')}
                              >
                                All Sales
                              </button>
                            )}
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                            {liveRecentSales.map((s) => (
                              <div className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[100px_1fr_100px]" key={s.id || s.saleId}>
                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-tight">{new Date(s.timestamp).toLocaleDateString()}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{s.client?.name || 'Guest'}</p>
                                  <p className="text-[10px] text-[var(--muted)] truncate">ID: {s.saleId}</p>
                                </div>
                                <span className="font-black text-[var(--accent)] text-right">₹{s.total}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {card.id === 'Revenue' && user?.role === 'Admin' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
                          <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-h2 flex items-center gap-2">
                              <BarChart3 size={22} className="text-[var(--accent)]" /> Revenue pulse
                            </h2>
                            <div className="h-8 w-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
                              <TrendingUp size={14} />
                            </div>
                          </div>
                          <p className="text-h1 mt-2">₹{totalRev.toLocaleString()}</p>
                          <div className="space-y-6 mt-6">
                            {liveRevenuePulse.map((item) => (
                              <div key={item.label}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-tiny font-bold">{item.label}</span>
                                  <span className="text-sm font-black text-[var(--accent)]">{item.percentage}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[var(--soft)] overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${item.color}`} style={{ width: `${item.percentage}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {card.id === 'Elegance' && (
                        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur h-full">
                          <h2 className="text-h2 flex items-center gap-2">
                            <ShieldCheck size={20} /> Client elegance score
                          </h2>
                          <p className="text-para mt-1">Retention, repeat orders, and fulfillment quality</p>
                          <div className="mt-6 grid gap-4 sm:grid-cols-3">
                            {(() => {
                              const totalClientsCount = clients.length || 0;
                              const totalOrdersCount = orders.length || 0;
                              const clientTransactionMap = {};
                              orders.forEach(o => {
                                const cid = o.clientId || o.client;
                                if (cid) clientTransactionMap[cid] = (clientTransactionMap[cid] || 0) + 1;
                              });
                              const repeatClientsCount = Object.values(clientTransactionMap).filter(count => count > 1).length;
                              const retentionRate = totalClientsCount > 0 ? Math.round((repeatClientsCount / totalClientsCount) * 100) : 0;
                              const repeatOrdersCount = orders.filter(o => clientTransactionMap[o.clientId || o.client] > 1).length;
                              const repeatOrdersRate = totalOrdersCount > 0 ? Math.round((repeatOrdersCount / totalOrdersCount) * 100) : 0;
                              const completedOrders = orders.filter(o => o.status === 'Completed').length;
                              const fulfillmentRate = totalOrdersCount > 0 ? Math.round((completedOrders / totalOrdersCount) * 100) : 0;

                              return [
                                { label: 'Retention', value: `${retentionRate}%` },
                                { label: 'Repeat orders', value: `${repeatOrdersRate}%` },
                                { label: 'Fulfillment', value: `${fulfillmentRate}%` }
                              ].map((item) => (
                                <div className="rounded-2xl bg-[var(--soft)] p-4" key={item.label}>
                                  <p className="text-h1">{item.value}</p>
                                  <p className="text-tiny mt-1">{item.label}</p>
                                </div>
                              ));
                            })()}
                          </div>
                        </section>
                      )}
                    </div>
  );


  return (
    <div className="relative min-h-screen">
      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 lg:hidden backdrop-blur-md transition-opacity duration-300"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[100] border-r border-[var(--border)] text-[var(--text)] shadow-[15px_0_80px_rgba(0,0,0,0.15)] ${transitionClass} flex flex-col ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} w-72 bg-[var(--surface-strong)]`}
      >
        <div className="flex shrink-0 h-20 items-center justify-between border-b border-[var(--border)] px-5 sticky top-0 z-10 bg-[var(--surface-strong)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm">
              <img src="/logo-black.png" alt="CB" className="h-full w-full object-contain" />
            </div>
            {(!isSidebarCollapsed || isMobileSidebarOpen) && (
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)] font-semibold">
                  Boutique
                </p>
                <h2 className="truncate text-lg font-semibold text-[var(--text)]">Malka ERP</h2>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--accent)] lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
              title="Close sidebar"
              type="button"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              className="hidden grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--accent)] lg:grid absolute right-[-20ox]"
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              type="button"
            >
              {isSidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-hide space-y-2 px-4 py-6 pb-20" onScroll={() => setFlyoutMenu(null)}>
          {navItems.filter(item => {
            if (['users', 'inventory', 'reports', 'account'].includes(item.id) && user?.role !== 'Admin' && user?.role !== 'Owner') return false;
            return true;
          }).map(({ label, icon: Icon, hasSubmenu, submenu, id }, index) => (
            <div key={label} className="relative">
              <button
                className={`group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition ${activeSidebarPage === id || (hasSubmenu && submenu.some(s => s.id === activeSidebarPage))
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)] shadow-sm'
                  : 'text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]'
                  }`}
                onClick={(e) => {
                  if (hasSubmenu) {
                    if (isSidebarCollapsed && !isMobileSidebarOpen) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setFlyoutMenu(flyoutMenu?.label === label ? null : { top: rect.top, label, submenu })
                    } else {
                      setExpandedSubmenu(expandedSubmenu === label ? null : label)
                    }
                  } else {
                    setCurrentPage(id)
                    setFlyoutMenu(null)
                    setIsMobileSidebarOpen(false)
                  }
                }}
                title={isSidebarCollapsed ? label : undefined}
                type="button"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${activeSidebarPage === id || (hasSubmenu && submenu.some(s => s.id === activeSidebarPage)) ? 'bg-[var(--surface-strong)] shadow-sm text-[var(--accent)]' : 'bg-transparent group-hover:bg-[var(--surface-strong)] text-[var(--muted)] group-hover:text-[var(--text)]'}`}>
                  <Icon size={18} />
                </span>
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <>
                    <span className="flex-1">{label}</span>
                    {hasSubmenu && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${expandedSubmenu === label ? 'rotate-180' : ''}`}
                      />
                    )}
                  </>
                )}
              </button>
              {hasSubmenu && (!isSidebarCollapsed || isMobileSidebarOpen) && (
                <div
                  className={`ml-12 mt-1 space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${expandedSubmenu === label ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  {submenu.map((subItem) => (
                    <button
                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm transition hover:bg-[var(--soft)] hover:text-[var(--text)] ${activeSidebarPage === subItem.id ? 'text-[var(--accent)] font-semibold' : 'text-[var(--muted)]'
                        }`}
                      key={subItem.label}
                      onClick={() => {
                        setCurrentPage(subItem.id)
                        setIsMobileSidebarOpen(false)
                      }}
                      type="button"
                    >
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

      </aside>

      <div className={`min-w-0 bg-[var(--page-bg)] ${transitionClass} ${sidebarWidth}`}>
        <header className={`sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-sm backdrop-blur-xl lg:px-8 transition-transform duration-300 ease-in-out ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm transition hover:bg-[var(--soft)] lg:hidden"
                onClick={() => setIsMobileSidebarOpen(true)}
                type="button"
              >
                <Menu size={20} className="text-[var(--text)]" />
              </button>
              <div className="hidden sm:block">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)] lg:text-sm">
                  <Sparkles size={14} /> Designer dashboard
                </p>
                {isAuthLoading ? (
                  <div className="skeleton h-8 w-48 mt-1 rounded-lg" />
                ) : (
                  <h3 className="text-lg font-semibold lg:text-3xl">{currentUserName || 'Admin'}</h3>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative hidden md:block" ref={searchRef}>
                <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--muted)] shadow-sm">
                  <Search size={17} />
                  <input
                    className="w-64 bg-transparent outline-none placeholder:text-stone-400"
                    placeholder="Search anything..."
                    type="search"
                    value={globalSearch}
                    onChange={(e) => {
                      setGlobalSearch(e.target.value)
                      setIsGlobalSearchOpen(true)
                    }}
                    onFocus={() => setIsGlobalSearchOpen(true)}
                  />
                </label>

                {isGlobalSearchOpen && globalSearch.trim() && (
                  <div className="absolute right-0 top-full mt-3 w-[450px] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl backdrop-blur-xl">
                    <div className="max-h-[70vh] overflow-y-auto p-2">
                      {!hasSearchResults ? (
                        <div className="p-8 text-center">
                          <Search size={32} className="mx-auto mb-3 opacity-20" />
                          <p className="text-sm font-medium text-[var(--muted)]">No results found for "{globalSearch}"</p>
                        </div>
                      ) : (
                        <div className="space-y-4 p-2">
                          {searchResults.clients.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Clients</p>
                              {searchResults.clients.map(c => (
                                <button
                                  key={c.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightClientId(c.id)
                                    setCurrentPage('view-clients')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{c.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">{c.phone}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.orders.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Orders</p>
                              {searchResults.orders.map(o => (
                                <button
                                  key={o.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightOrderId(o.id)
                                    setCurrentPage('view-orders')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--jewel)] text-white"><ShoppingBag size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{o.product} for {o.clientName}</p>
                                    <p className="text-[10px] text-[var(--muted)]">Order #{o.id} • {o.status}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.inventory.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Inventory</p>
                              {searchResults.inventory.map(p => (
                                <button
                                  key={p.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightInventoryId(p.id)
                                    setCurrentPage('view-inventory')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-stone-100 text-stone-600"><Package size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{p.productName}</p>
                                    <p className="text-[10px] text-[var(--muted)]">ID: {p.productId} • Stock: {p.quantity} {p.unit}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.sales.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Sales Transactions</p>
                              {searchResults.sales.map(s => (
                                <button
                                  key={s.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightSaleId(s.saleId)
                                    setCurrentPage('view-sales')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-green-50 text-green-600"><TrendingUp size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{s.saleId} - {s.client?.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">Total: ₹{s.total} • {new Date(s.timestamp).toLocaleDateString()}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.users.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">System Users</p>
                              {searchResults.users.map(u => (
                                <button
                                  key={u.id || u.email}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setCurrentPage('view-users')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><ShieldCheck size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{u.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">{u.email} • {u.designation || u.role}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.staffPayroll?.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Staff Payroll</p>
                              {searchResults.staffPayroll.map(s => (
                                <button
                                  key={s.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightStaffId(s.id)
                                    setCurrentPage('staff-management')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--soft)] text-[var(--text)]"><UsersRound size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{s.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">{s.designation} • {s.phone}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.accounts?.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Account Records</p>
                              {searchResults.accounts.map(a => (
                                <button
                                  key={a.id}
                                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                  onClick={() => {
                                    setHighlightAccountId(a.id)
                                    setCurrentPage('view-accounts')
                                    setIsGlobalSearchOpen(false)
                                    setGlobalSearch('')
                                  }}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><BarChart3 size={16} /></div>
                                  <div>
                                    <p className="text-sm font-bold">{a.partyName} <span className="font-normal text-xs">({a.type})</span></p>
                                    <p className="text-[10px] text-[var(--muted)]">{a.category} • ₹{a.amount}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.pages.length > 0 && (
                            <div>
                              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Navigation</p>
                              {searchResults.pages.map(p => {
                                const Icon = p.icon || Search;
                                return (
                                  <button
                                    key={p.id}
                                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                                    onClick={() => {
                                      setCurrentPage(p.id)
                                      setIsGlobalSearchOpen(false)
                                      setGlobalSearch('')
                                    }}
                                  >
                                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--soft)] text-[var(--text)]"><Icon size={16} /></div>
                                    <div>
                                      <p className="text-sm font-bold">{p.label}</p>
                                      <p className="text-[10px] text-[var(--muted)]">Go to page</p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-[var(--border)] bg-[var(--soft)] px-4 py-2 text-[9px] font-bold text-[var(--muted)] uppercase">
                      Tip: Search by name, phone, order ID or product name
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)] shadow-sm transition hover:text-[var(--accent)]"
                  onClick={() => setShowAlertsDropdown((value) => !value)}
                  type="button"
                >
                  <Bell size={18} />
                  {activities.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow" />}
                </button>
                {showAlertsDropdown && (
                  <div className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl shadow-black/10">
                    <div className="bg-[var(--soft)] px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-label">Activity Notifications</p>
                        <p className="text-meta">{activities.length} recent events</p>
                      </div>
                      {activities.length > 0 && (
                        <button
                          className="text-xs font-semibold text-[var(--accent)] hover:underline"
                          onClick={() => {
                            setActivities([])
                            localStorage.setItem('activities', '[]')
                            supabase.from('erp_activities').delete().neq('id', '0').then()
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {activities.length > 0 ? activities.slice(0, 5).map(activity => (
                        <div key={activity.id} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--soft)] border-b border-[var(--border)] last:border-0">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] mt-1">
                            <Bell size={14} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-label text-[var(--text)]">{activity.title}</p>
                            <p className="text-meta mt-0.5 break-words">{activity.description}</p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <p className="text-tiny text-[var(--muted)]">{formatDateTimeDDMMYY(activity.timestamp)}</p>
                              <p className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-tiny text-[var(--accent)]">
                                {activity.actor}
                              </p>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No recent activity</div>
                      )}
                    </div>
                    {activities.length > 5 && (
                      <button
                        className="flex w-full items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--soft)]"
                        type="button"
                        onClick={() => {
                          setShowAlertsDropdown(false)
                          setShowAllNotifications(true)
                        }}
                      >
                        View all notifications
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-2 pr-3 text-left shadow-sm transition hover:border-[var(--accent)]"
                  onClick={() => setShowAccountMenu((value) => !value)}
                  type="button"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white p-0.5 shadow-sm">
                    <img src="/logo-black.png" alt="AD" className="h-full w-full object-contain" />
                  </span>
                  <span className="hidden leading-tight sm:block">
                    {isAuthLoading ? (
                      <div className="space-y-1">
                        <div className="skeleton h-3 w-20 rounded" />
                        <div className="skeleton h-2 w-24 rounded" />
                      </div>
                    ) : (
                      <>
                        <span className="block text-sm font-semibold truncate max-w-[100px]">{currentUserName}</span>
                        <span className="block text-xs text-[var(--muted)]">{user?.email || 'admin@malka.com'}</span>
                      </>
                    )}
                  </span>
                  <ChevronDown size={16} className="text-[var(--muted)]" />
                </button>

                {showAccountMenu && (
                  <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl shadow-black/10">
                    <div className="bg-[var(--soft)] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] font-black text-white">
                          AD
                        </span>
                        <div>
                          <p className="text-sm font-semibold truncate">{currentUserName}</p>
                          <p className="text-xs text-[var(--muted)]">{user?.email || 'admin@malka.com'}</p>
                        </div>
                      </div>
                    </div>
                    {(user?.role === 'Admin' || user?.role === 'Owner') && (
                      <button
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--soft)]"
                        onClick={() => {
                          setShowAccountMenu(false)
                          setShowAccountPanel(true)
                        }}
                        type="button"
                      >
                        <Settings size={17} /> Account Details
                      </button>
                    )}
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--soft)]"
                      onClick={onLogout}
                      type="button"
                    >
                      <LogOut size={17} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 bg-[var(--background)] relative">
          {/* Global Toast Removed from here to prevent double toast */}
          <div className="space-y-6 p-5 lg:p-8 pb-28 lg:pb-8">
            {currentPage === 'overview' && (
              <div id="dashboard-overview-wrapper" className="flex flex-col gap-10">
                {(() => {
                  const visibleCards = dashboardCards.filter(c => c.visible && (!c.adminOnly || user?.role === 'Admin'));
                  const groups = [];
                  let currentGroup = { isFull: false, items: [] };
                  visibleCards.forEach(card => {
                    const isFull = getCardSpan(card).includes('span-full');
                    if (isFull !== currentGroup.isFull) {
                      if (currentGroup.items.length > 0) groups.push(currentGroup);
                      currentGroup = { isFull, items: [card] };
                    } else {
                      currentGroup.items.push(card);
                    }
                  });
                  if (currentGroup.items.length > 0) groups.push(currentGroup);

                  return groups.map((group, groupIdx) => {
                    if (group.isFull) {
                      return (
                        <div key={groupIdx} className="flex flex-col gap-6">
                          {group.items.map((card, idx) => renderDashboardCard(card, visibleCards.indexOf(card)))}
                        </div>
                      );
                    } else {
                      return (
                        <Masonry key={groupIdx} breakpointCols={{default: 2, 1023: 1}} className="my-masonry-grid" columnClassName="my-masonry-grid_column">
                          {group.items.map((card, idx) => renderDashboardCard(card, visibleCards.indexOf(card)))}
                        </Masonry>
                      );
                    }
                  });
                })()}

                {/* Manage Cards Button */}
                <div className="flex items-center justify-center pt-8">
                  <div className="relative">
                    <button
                      onClick={() => setShowManageMenu(!showManageMenu)}
                      className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] px-8 py-4 text-sm font-bold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-95"
                    >
                      <LayoutDashboard size={20} /> Manage Dashboard Layout
                    </button>
                    <div className={`absolute bottom-full left-1/2 mb-4 w-64 -translate-x-1/2 rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-2xl transition-all duration-300 z-[100] ${showManageMenu ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Customize Your View</p>
                        <button onClick={() => setShowManageMenu(false)} className="text-[var(--muted)] hover:text-[var(--text)]">
                          <AlertCircle size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {dashboardCards.map(card => (
                          <button
                            key={card.id}
                            onClick={() => toggleCardVisibility(card.id, !card.visible)}
                            className={`flex w-full items-center justify-between rounded-xl p-3 text-left text-xs font-bold transition ${card.visible ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                          >
                            <span>{card.label}</span>
                            <div className={`h-4 w-4 rounded-full border-2 border-current flex items-center justify-center`}>
                              {card.visible && <div className="h-2 w-2 rounded-full bg-current" />}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 text-[9px] text-[var(--muted)] text-center">Tip: Drag cards to reorder them!</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Suspense fallback={
                <div className="flex h-full flex-col gap-6 p-4 sm:p-6 md:p-8 overflow-hidden">
                  {currentPage !== 'overview' && (
                    <div className="relative z-30 float-left mt-0.5 mr-4 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--surface-strong)] animate-pulse border border-[var(--border)]" />
                  )}
                  {/* Header Skeleton */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col gap-2">
                      <div className="h-8 w-48 rounded-xl bg-[var(--surface-strong)] animate-pulse border border-[var(--border)]"></div>
                      <div className="h-4 w-32 rounded-lg bg-[var(--surface-strong)] animate-pulse border border-[var(--border)]"></div>
                    </div>
                    <div className="h-10 w-32 rounded-xl bg-[var(--accent)]/10 animate-pulse border border-[var(--accent)]/20"></div>
                  </div>
                  
                  {/* Stats/Cards Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-32 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm animate-pulse p-5 flex flex-col justify-between overflow-hidden relative">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                        <div className="flex justify-between items-start">
                          <div className="h-4 w-24 rounded-lg bg-[var(--surface-strong)]"></div>
                          <div className="h-8 w-8 rounded-full bg-[var(--surface-strong)]"></div>
                        </div>
                        <div className="h-8 w-32 rounded-xl bg-[var(--surface-strong)]"></div>
                      </div>
                    ))}
                  </div>

                  {/* Table/List Skeleton */}
                  <div className="flex-1 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm p-5 flex flex-col gap-4 animate-pulse mt-2 overflow-hidden relative">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                    <div className="h-6 w-1/4 rounded-lg bg-[var(--surface-strong)] mb-4"></div>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex justify-between items-center py-4 border-b border-[var(--border)]/50 last:border-0">
                        <div className="h-5 w-1/4 rounded-lg bg-[var(--surface-strong)]"></div>
                        <div className="h-5 w-1/5 rounded-lg bg-[var(--surface-strong)] hidden sm:block"></div>
                        <div className="h-5 w-1/6 rounded-lg bg-[var(--surface-strong)] hidden md:block"></div>
                        <div className="h-8 w-20 rounded-xl bg-[var(--surface-strong)]"></div>
                      </div>
                    ))}
                  </div>
                </div>
              }>
              {currentPage !== 'overview' && (
                <button 
                  onClick={goBack}
                  className="relative z-30 float-left mt-0.5 mr-4 grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all"
                  aria-label="Go Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              )}
              {currentPage === 'add-order' && <AddOrderPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} orders={orders} setOrders={setOrders} clients={clients} inventory={inventory} setInventory={setInventory} orderTypes={orderTypes} setOrderTypes={setOrderTypes} productTypes={productTypes} setProductTypes={setProductTypes} inventoryUnits={inventoryUnits} setInventoryUnits={setInventoryUnits} saveOrder={saveOrder} saveConfig={saveConfig} orderLimits={orderLimits} setOrderLimits={setOrderLimits} cloudLoaded={cloudLoaded} currentUser={user} />}
              {currentPage === 'view-orders' && <ViewOrdersPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} setSelectedClient={setSelectedClient} setClientDetailMode={setClientDetailMode} showGlobalToast={showGlobalToast} currentUser={user} highlightOrderId={highlightOrderId} setHighlightOrderId={setHighlightOrderId} orders={orders} setOrders={setOrders} inventory={inventory} setInventory={setInventory} clients={clients} saveOrder={saveOrder} deleteOrder={deleteOrder} cloudLoaded={cloudLoaded} />}
              {currentPage === 'add-clients' && <AddClientsPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} currentUser={user} clients={clients} setClients={setClients} saveClient={saveClient} productTypes={productTypes} setProductTypes={setProductTypes} saveConfig={saveConfig} cloudLoaded={cloudLoaded} />}
              {currentPage === 'view-clients' && <ViewClientsPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} setSelectedClient={setSelectedClient} setClientDetailMode={setClientDetailMode} showGlobalToast={showGlobalToast} currentUser={user} highlightClientId={highlightClientId} setHighlightClientId={setHighlightClientId} clients={clients} setClients={setClients} saveClient={saveClient} deleteClient={deleteClient} cloudLoaded={cloudLoaded} />}
              {currentPage === 'client-detail' && <ClientDetailPage themeStyle={themeStyle} client={selectedClient} setCurrentPage={setCurrentPage} setSelectedClient={setSelectedClient} initialMode={clientDetailMode} setClientDetailMode={setClientDetailMode} showGlobalToast={showGlobalToast} currentUser={user} clients={clients} setClients={setClients} saveClient={saveClient} deleteClient={deleteClient} productTypes={productTypes} setProductTypes={setProductTypes} saveConfig={saveConfig} cloudLoaded={cloudLoaded} />}
              {currentPage === 'create-inventory' && <CreateInventoryPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} inventory={inventory} setInventory={setInventory} productTypes={productTypes} setProductTypes={setProductTypes} inventoryUnits={inventoryUnits} setInventoryUnits={setInventoryUnits} saveConfig={saveConfig} saveInventory={saveInventory} cloudLoaded={cloudLoaded} />}
              {currentPage === 'view-inventory' && <ViewInventoryPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} currentUser={user} setSelectedInventoryItem={setSelectedInventoryItem} setInventoryDetailMode={setInventoryDetailMode} highlightInventoryId={highlightInventoryId} setHighlightInventoryId={setHighlightInventoryId} inventory={inventory} setInventory={setInventory} cloudLoaded={cloudLoaded} />}
              {currentPage === 'inventory-detail' && <InventoryDetailPage themeStyle={themeStyle} item={selectedInventoryItem} setCurrentPage={setCurrentPage} setSelectedInventoryItem={setSelectedInventoryItem} initialMode={inventoryDetailMode} setInventoryDetailMode={setInventoryDetailMode} showGlobalToast={showGlobalToast} currentUser={user} inventory={inventory} setInventory={setInventory} saveInventory={saveInventory} cloudLoaded={cloudLoaded} />}
              {currentPage === 'create-sales' && <CreateSalesPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} currentUser={user} sales={sales} setSales={setSales} clients={clients} setClients={setClients} orders={orders} setOrders={setOrders} inventory={inventory} setInventory={setInventory} saveSale={saveSale} saveOrder={saveOrder} cloudLoaded={cloudLoaded} />}
              {currentPage === 'view-sales' && <ViewSalesPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} currentUser={user} highlightSaleId={highlightSaleId} setHighlightSaleId={setHighlightSaleId} sales={sales} setSales={setSales} inventory={inventory} setInventory={setInventory} orders={orders} setOrders={setOrders} cloudLoaded={cloudLoaded} />}
              {currentPage === 'add-income' && <AddIncomePage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories} saveConfig={saveConfig} sales={sales} orders={orders} refreshAccounts={fetchAllAccountsData} />}
              {currentPage === 'add-expense' && <AddExpensePage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories} saveConfig={saveConfig} inventory={inventory} staffList={staffList} setStaffList={setStaffList} refreshAccounts={fetchAllAccountsData} />}
              {currentPage === 'staff-management' && <StaffManagementPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} staffList={staffList} setStaffList={setStaffList} saveConfig={saveConfig} highlightStaffId={highlightStaffId} setHighlightStaffId={setHighlightStaffId} allAccounts={allAccounts} />}
              {currentPage === 'view-accounts' && <ViewAccountsPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} currentUser={user} highlightAccountId={highlightAccountId} setHighlightAccountId={setHighlightAccountId} refreshAccounts={fetchAllAccountsData} setHighlightOrderId={setHighlightOrderId} setHighlightSaleId={setHighlightSaleId} />}
              {currentPage === 'reports' && <ReportsPage themeStyle={themeStyle} showGlobalToast={showGlobalToast} currentUser={user} sales={sales} orders={orders} clients={clients} inventory={inventory} cloudLoaded={cloudLoaded} />}
              {currentPage === 'create-user' && <CreateUserPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} users={users} setUsers={setUsers} designations={designations} setDesignations={setDesignations} currentUser={user} saveUser={saveUser} cloudLoaded={cloudLoaded} />}
              {currentPage === 'view-users' && <ViewUsersPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} users={users} setUsers={setUsers} designations={designations} setDesignations={setDesignations} currentUser={user} cloudLoaded={cloudLoaded} />}
              {currentPage === 'create-design' && <CreateDesignPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} editingDesign={editingDesign} setEditingDesign={setEditingDesign} />}
              {currentPage === 'design-library' && <DesignLibraryPage themeStyle={themeStyle} setCurrentPage={setCurrentPage} showGlobalToast={showGlobalToast} setEditingDesign={setEditingDesign} />}
            </Suspense>
            {syncError && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500 flex items-center gap-3">
                <AlertCircle size={18} />
                Failed to sync with cloud. Offline mode active.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAccountPanel && (
        <AccountDetailsModal
          fullUser={loggedInUserInList || user}
          onClose={() => setShowAccountPanel(false)}
          onChanged={onLogout}
          onLogout={onLogout}
          themeStyle={themeStyle}
        />
      )}

      {showAllNotifications && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 px-4 backdrop-blur-sm" style={themeStyle}>
          <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-6 pb-5">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-[var(--text)]">
                <Bell size={20} className="text-[var(--accent)]" /> All Notifications
              </h2>
              <div className="flex items-center gap-4">
                {activities.length > 0 && (
                  <button
                    className="text-sm font-semibold text-red-500 hover:text-red-600 transition"
                    onClick={() => {
                      setActivities([])
                      localStorage.setItem('activities', '[]')
                      setNotificationsPage(1)
                      supabase.from('erp_activities').delete().neq('id', '0').then()
                    }}
                  >
                    Clear All
                  </button>
                )}
                <button
                  className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"
                  onClick={() => setShowAllNotifications(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activities.length > 0 ? (
                activities.slice((notificationsPage - 1) * notificationsPerPage, notificationsPage * notificationsPerPage).map(activity => (
                  <div key={activity.id} className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:bg-[var(--soft)]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mt-0.5">
                      <Bell size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <p className="text-base font-semibold text-[var(--text)]">{activity.title}</p>
                        <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">By {activity.actor}</span>
                      </div>
                      <p className="text-sm text-[var(--text)] opacity-90">{activity.description}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--muted)] opacity-75">{formatDateTimeDDMMYY(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Bell size={48} className="mx-auto text-[var(--muted)] opacity-30 mb-4" />
                  <p className="text-[var(--muted)] font-medium">No activity recorded yet.</p>
                </div>
              )}
            </div>

            {activities.length > notificationsPerPage && (
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm text-[var(--muted)]">
                  Showing {((notificationsPage - 1) * notificationsPerPage) + 1} to {Math.min(notificationsPage * notificationsPerPage, activities.length)} of {activities.length}
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--soft)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)]"
                    onClick={() => setNotificationsPage(p => Math.max(1, p - 1))}
                    disabled={notificationsPage === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--soft)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)]"
                    onClick={() => setNotificationsPage(p => Math.min(Math.ceil(activities.length / notificationsPerPage), p + 1))}
                    disabled={notificationsPage === Math.ceil(activities.length / notificationsPerPage)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Theme Button */}
      <button
        className="fixed right-0 top-1/2 z-[90] -translate-y-1/2 flex h-14 w-12 items-center justify-center rounded-l-2xl border border-r-0 border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow)] transition-all hover:w-14 hover:bg-[var(--soft)]"
        onClick={() => setShowThemeDropdown(true)}
      >
        <Palette size={20} className="text-[var(--accent)]" />
      </button>

      {/* Slide-out Theme Panel */}
      <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${showThemeDropdown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" onClick={() => setShowThemeDropdown(false)} />
        <div className={`absolute right-0 top-0 bottom-0 w-80 border-l border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow)] transition-transform duration-300 ${showThemeDropdown ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
              <Palette size={20} className="text-[var(--accent)]" /> Theme Settings
            </h2>
            <button onClick={() => setShowThemeDropdown(false)} className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Appearance</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${appearance === 'light' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                  onClick={() => setAppearance('light')}
                >
                  <Sun size={16} /> Light
                </button>
                <button
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${appearance === 'dark' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                  onClick={() => setAppearance('dark')}
                >
                  <Moon size={16} /> Dark
                </button>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Color Palette</p>
              <div className="space-y-3">
                {Object.entries(boutiqueThemes).map(([key, theme]) => (
                  <button
                    className={`flex w-full items-center justify-between rounded-xl border p-4 transition-all ${themeName === key ? 'border-[var(--accent)] bg-[var(--soft)] shadow-sm' : 'border-[var(--border)] bg-transparent hover:border-[var(--accent)]'}`}
                    key={key}
                    onClick={() => setThemeName(key)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-5 w-5 rounded-full shadow-sm" style={{ backgroundColor: theme.accent }} />
                      <span className={`font-semibold ${themeName === key ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{theme.name}</span>
                    </div>
                    {themeName === key && <Crown size={16} className="text-[var(--accent)]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[var(--border)] bg-[var(--surface-strong)]/80 p-2 pb-6 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] lg:hidden">
        <div className="flex items-center justify-around">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Home' },
            { id: 'view-clients', icon: UsersRound, label: 'Clients' },
            { id: 'view-orders', icon: ShoppingBag, label: 'Orders' },
            { id: 'view-sales', icon: TrendingUp, label: 'Sales' },
            { id: 'view-inventory', icon: Package, label: 'Stock', adminOnly: true },
            { id: 'reports', icon: BarChart3, label: 'Reports', adminOnly: true },
          ].filter(item => !item.adminOnly || user?.role === 'Admin').map((item) => {
            const isActive = activeSidebarPage === item.id;
            return (
              <button
                key={item.id}
                className={`flex flex-col items-center gap-1 p-2 transition-all ${isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <item.icon size={isActive ? 22 : 20} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                {isActive && <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Toast Notification */}
      <div className={`fixed bottom-24 left-0 right-0 z-[2000] mx-auto flex justify-center px-4 transition-all duration-500 ${globalToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        {globalToast && (
          <div className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 pr-6 shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-inner">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text)] tracking-tight">{globalToast.title}</p>
              <p className="text-xs font-medium text-[var(--muted)] mt-0.5">{globalToast.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Global Flyout Menu for Collapsed Sidebar */}
      {flyoutMenu && (
        <>
          <div
            id="flyout-menu"
            className="fixed z-[200] w-48 rounded-2xl bg-[var(--surface-strong)] shadow-2xl shadow-black/20 border border-[var(--border)] overflow-hidden py-2 animate-in fade-in slide-in-from-left-2"
            style={{ top: flyoutMenu.top, left: '5.5rem' }}
          >
            <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] border-b border-[var(--border)] mb-1">
              {flyoutMenu.label}
            </div>
            {flyoutMenu.submenu.map((subItem) => (
              <button
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-[var(--soft)] hover:text-[var(--text)] ${activeSidebarPage === subItem.id ? 'text-[var(--accent)] font-semibold bg-[var(--accent-soft)]' : 'text-[var(--muted)]'
                  }`}
                key={subItem.label}
                onClick={() => {
                  setCurrentPage(subItem.id)
                  setFlyoutMenu(null)
                }}
                type="button"
              >
                {subItem.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard;
