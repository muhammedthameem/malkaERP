import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, CircleDollarSign, ClipboardList, Search, Eye, Pencil, Trash2, CheckCircle, Clock, Play, Pause, CheckCircle2, Plus, X, Printer, Calendar, AlertCircle, XCircle, ZoomIn } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { Virtuoso } from 'react-virtuoso'
import { formatDateDDMMYY, getIndianDate, orders as dummyOrders, DEFAULT_WORKFLOWS, PRODUCTION_STAGES, calculateProgress, calculateRisk } from '../../utils/constants'
import { sendWhatsApp } from "../../utils/whatsapp";
import supabase from '../../supabase'
import { encryptId } from '../../utils/security'
import UndoToast from '../../components/UndoToast'

function ViewOrdersPage({ themeStyle, setCurrentPage, setSelectedClient, setClientDetailMode, showGlobalToast, currentUser, highlightOrderId, setHighlightOrderId, orders, setOrders, inventory, setInventory, clients, saveOrder, deleteOrder, cloudLoaded }) {
  const rowRefs = useRef({});
  const tableContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const [searchQuery, setSearchQuery] = useState('')
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const itemsPerPage = 10
  const [imagePopup, setImagePopup] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [orderToDelete, setOrderToDelete] = useState(null)
  const [recentlyDeletedOrder, setRecentlyDeletedOrder] = useState(null)
  const undoTimeoutRef = useRef(null)
  const pendingSaves = useRef({})
  const [viewOrder, setViewOrder] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' })
  const [dateFilter, setDateFilter] = useState('All') // All, Today, Tomorrow, Week, Custom
  const [customDate, setCustomDate] = useState(getIndianDate())
  const [showWaPopup, setShowWaPopup] = useState(false)
  const [waData, setWaData] = useState({ phone: '', name: '', message: '', orderId: '' })
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [openStagePopoverId, setOpenStagePopoverId] = useState(null)
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [mobileVisibleCount, setMobileVisibleCount] = useState(5)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openStagePopoverId && !e.target.closest('.stage-popover-container')) {
        setOpenStagePopoverId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openStagePopoverId]);

  const isDataLoading = !cloudLoaded && (!orders || orders.length === 0);

  const saveOrders = (newOrders) => {
    setOrders(newOrders)
  }

  const handleDeleteConfirm = async () => {
    if (orderToDelete) {
      const idToDelete = orderToDelete.id;
      const order = { ...orderToDelete };

      setRecentlyDeletedOrder(order);
      setOrderToDelete(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

      // 1. Restore Inventory Locally (Instant)
      let updatedInventory = [...inventory];
      if (order.sourceOfMaterial === 'Internal' && order.internalItems?.length > 0) {
        order.internalItems.forEach(mat => {
          updatedInventory = updatedInventory.map(invItem => {
            if (invItem.id === mat.inventoryId || (mat.productId && invItem.productId === mat.productId)) {
              const currentQty = parseFloat(invItem.quantity) || 0;
              const restoreQty = parseFloat(mat.quantity) || 0;
              return { ...invItem, quantity: currentQty + restoreQty };
            }
            return invItem;
          });
        });
        setInventory(updatedInventory);
      }

      // 2. Immediate Background Cloud Sync
      try {
        if (deleteOrder) {
          await deleteOrder(idToDelete);
        } else {
          await supabase.from('erp_orders').delete().eq('id', idToDelete);
        }

        // Sync restored inventory to Supabase
        if (order.sourceOfMaterial === 'Internal' && order.internalItems?.length > 0) {
          const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === "" ? undefined : v));
          updatedInventory.forEach(invItem => {
            const orig = inventory.find(i => i.id === invItem.id);
            if (orig && orig.quantity !== invItem.quantity) {
              supabase.from('erp_inventory').upsert([{ id: invItem.id.toString(), data: clean(invItem) }]).then(({ error }) => {
                if (error) console.error("Inventory sync failed:", error);
              });
            }
          });
        }
      } catch (err) {
        console.error("Cloud delete failed:", err);
      }
    }
  }

  const handleUndoDelete = async () => {
    if (!recentlyDeletedOrder) return;

    // 1. Re-insert order to DB
    const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === "" ? undefined : v));
    await supabase.from('erp_orders').upsert([{ id: recentlyDeletedOrder.id.toString(), data: clean(recentlyDeletedOrder) }]);

    // 2. Reverse Inventory Locally
    let updatedInventory = [...inventory];
    if (recentlyDeletedOrder.sourceOfMaterial === 'Internal' && recentlyDeletedOrder.internalItems?.length > 0) {
      recentlyDeletedOrder.internalItems.forEach(mat => {
        updatedInventory = updatedInventory.map(invItem => {
          if (invItem.id === mat.inventoryId || (mat.productId && invItem.productId === mat.productId)) {
            const currentQty = parseFloat(invItem.quantity) || 0;
            const restoreQty = parseFloat(mat.quantity) || 0;
            return { ...invItem, quantity: currentQty - restoreQty }; // Deduct it again
          }
          return invItem;
        });
      });
      setInventory(updatedInventory);

      // 3. Re-Sync Reversed inventory to DB
      updatedInventory.forEach(invItem => {
        const orig = inventory.find(i => i.id === invItem.id);
        if (orig && orig.quantity !== invItem.quantity) {
          supabase.from('erp_inventory').upsert([{ id: invItem.id.toString(), data: clean(invItem) }]).then(({ error }) => {
            if (error) console.error("Inventory sync failed:", error);
          });
        }
      });
    }

    if (saveOrders) {
      saveOrders(prev => prev.some(o => o.id === recentlyDeletedOrder.id) ? prev : [...prev, recentlyDeletedOrder]);
    }
    if (showGlobalToast) showGlobalToast('Restored', `Order #${recentlyDeletedOrder.orderId || recentlyDeletedOrder.id} has been restored.`);
    setRecentlyDeletedOrder(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }

  const handleStatusChange = async (id, newStatus) => {
    const updated = orders.map(o => {
      if (o.id === id) {
        let newData = { ...o, status: newStatus, updatedAt: new Date().toISOString() }
        if (newStatus === 'In Progress' && !o.startDate) {
          newData.startDate = getIndianDate()
        }
        if (newStatus === 'Completed' || newStatus === 'Sold') {
          if (!o.completedDate) {
            newData.completedDate = getIndianDate()
          }
          if (!o.startDate) {
            newData.startDate = getIndianDate()
          }
          
          // Auto-sync Production Stage to avoid confusion
          newData.currentStage = 'Finished';
          if (newData.productionTasks) {
             newData.productionTasks = newData.productionTasks.map(task => ({
                 ...task,
                 status: 'Completed',
                 completedAt: task.completedAt || new Date().toISOString(),
                 startedAt: task.startedAt || new Date().toISOString()
             }));
          }
        }
        if (newStatus === 'Not Ready' || newStatus === 'Pending') {
          newData.startDate = null;
          newData.completedDate = null;
          newData.currentStage = 'Not Started';
          if (newData.productionTasks) {
            newData.productionTasks = newData.productionTasks.map(task => ({
              ...task, status: 'Pending', completedAt: null, startedAt: null
            }));
          }
        }
        if (newStatus === 'Hold') {
          if (newData.productionTasks) {
            newData.productionTasks = newData.productionTasks.map(task => 
              task.status === 'In Progress' ? { ...task, status: 'Hold' } : task
            );
          }
          if (newData.currentStage && newData.currentStage !== 'Finished' && newData.currentStage !== 'Not Started') {
             newData.currentStage = `Hold: ${newData.currentStage}`;
          }
        }
        if (newStatus !== 'Hold') {
          newData.lastActiveStatus = newStatus
        }
          
        newData.progress = calculateProgress(newData);
        newData.risk = calculateRisk(newData);

        return newData
      }
      return o
    })
    saveOrders(updated)

    // Cloud Sync: Persist the specific order change
    const changedOrder = updated.find(o => o.id === id)
    if (changedOrder && saveOrder) {
      saveOrder(changedOrder);
    }

    if (showGlobalToast) {
      const clientName = changedOrder?.clientName || 'Client';
      showGlobalToast('Status Updated', `Order status for ${clientName} changed to ${newStatus}`);
    }

    // Send WhatsApp notification when order is completed
    if (newStatus === 'Completed' && changedOrder) {
      const client = (clients || []).find(c => c.name === changedOrder.clientName);
      const phoneToUse = client?.mobile || changedOrder.clientPhone || '';

      let formattedPhone = String(phoneToUse).replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }

      const defaultMsg = `Hi ${changedOrder.clientName || 'Customer'}\nYour ${changedOrder.product || 'Item'} (#${changedOrder.orderId || changedOrder.id}) is ready for delivery. Please collect it.\n\nThank you,\nMalka`;

      setWaData({
        phone: formattedPhone,
        name: changedOrder.clientName || 'Customer',
        message: defaultMsg,
        orderId: changedOrder.orderId || changedOrder.id
      });
      setShowWaPopup(true);
    }
  }

  const handleProductionStageChange = async (id, newStage) => {
    const updated = orders.map(o => {
      if (o.id === id) {
        let newData = { ...o, currentStage: newStage, updatedAt: new Date().toISOString() };
        
        // Initialize workflow if missing
        if (!newData.workflow || !newData.productionTasks) {
          newData.workflow = DEFAULT_WORKFLOWS[newData.product] || DEFAULT_WORKFLOWS['Default'];
          newData.productionTasks = newData.workflow.map(stage => ({
            stage,
            status: 'Pending',
            startedAt: null,
            completedAt: null
          }));
        }

        // Update production tasks: Mark everything before newStage as Completed, newStage as In Progress
        if (newStage === 'Not Started') {
           if (newData.productionTasks) {
             newData.productionTasks = newData.productionTasks.map(task => ({
               ...task, status: 'Pending', completedAt: null, startedAt: null
             }));
           }
        } else if (newData.workflow && newData.productionTasks) {
           let found = false;
           const now = new Date().toISOString();
           newData.productionTasks = newData.productionTasks.map(task => {
             if (task.stage === newStage) {
               found = true;
               return { ...task, status: 'In Progress', startedAt: task.startedAt || now };
             }
             if (!found) {
               return { ...task, status: 'Completed', completedAt: task.completedAt || now, startedAt: task.startedAt || now };
             }
             return { ...task, status: 'Pending', completedAt: null, startedAt: null };
           });
        }
        
        // Auto update overall status
        if (newStage === 'Finished') {
           newData.status = 'Completed';
           if (!newData.completedDate) newData.completedDate = getIndianDate();
           
           // If they select Finished, mark the Finished task itself as completed
           if (newData.productionTasks) {
             newData.productionTasks = newData.productionTasks.map(task => 
               task.stage === 'Finished' ? { ...task, status: 'Completed', completedAt: task.completedAt || new Date().toISOString(), startedAt: task.startedAt || new Date().toISOString() } : task
             );
           }
        } else if (newData.status === 'Not Ready' || newData.status === 'Pending' || newData.status === 'Completed') {
           // Revert back to In Progress if it was completed but stage is changed backwards
           newData.status = 'In Progress';
           newData.completedDate = null;
           if (!newData.startDate) newData.startDate = getIndianDate();
        }

        // Recalculate progress & risk
        newData.progress = calculateProgress(newData);
        newData.risk = calculateRisk(newData);

        // Activity History
        if (!newData.activityHistory) newData.activityHistory = [];
        newData.activityHistory.push({
           stage: newStage,
           action: 'Started',
           timestamp: new Date().toISOString()
        });

        return newData;
      }
      return o;
    });
    saveOrders(updated);

    const changedOrder = updated.find(o => o.id === id);
    if (changedOrder && saveOrder) {
      saveOrder(changedOrder);
    }
    if (showGlobalToast) {
      showGlobalToast('Production Updated', `Work moved to ${newStage}`);
    }
  }

  const handleTaskStatusChange = async (id, stageName, newStatus) => {
    setOrders(prevOrders => {
      let changedOrder = null;
      const updated = prevOrders.map(o => {
        if (o.id === id) {
          let newData = { ...o, updatedAt: new Date().toISOString() };
          
          if (!newData.workflow || !newData.productionTasks) {
            newData.workflow = DEFAULT_WORKFLOWS[newData.product] || DEFAULT_WORKFLOWS['Default'];
            newData.productionTasks = newData.workflow.map(s => ({
              stage: s,
              status: 'Pending',
              startedAt: null,
              completedAt: null
            }));
          }

          const now = new Date().toISOString();
          newData.productionTasks = newData.productionTasks.map(task => {
            if (task.stage === stageName) {
              return {
                ...task,
                status: newStatus,
                startedAt: newStatus === 'In Progress' && !task.startedAt ? now : task.startedAt,
                completedAt: newStatus === 'Completed' ? now : (newStatus === 'Pending' ? null : task.completedAt)
              };
            }
            return task;
          });

          // Determine derived currentStage
          const activeTasks = newData.productionTasks.filter(t => t.status === 'In Progress');
          const completedTasks = newData.productionTasks.filter(t => t.status === 'Completed');
          const holdTasks = newData.productionTasks.filter(t => t.status === 'Hold');
          
          if (newStatus === 'Completed' && stageName === 'Finished') {
             newData.currentStage = 'Finished';
             newData.status = 'Completed';
             if (!newData.completedDate) newData.completedDate = getIndianDate();
             newData.productionTasks = newData.productionTasks.map(t => ({
                ...t, status: 'Completed', completedAt: t.completedAt || now
             }));
          } else if (newData.productionTasks.every(t => t.status === 'Completed')) {
             newData.currentStage = 'Finished';
             newData.status = 'Completed';
             if (!newData.completedDate) newData.completedDate = getIndianDate();
          } else if (newData.productionTasks.every(t => t.status === 'Pending')) {
             newData.currentStage = 'Not Started';
          } else if (activeTasks.length > 0) {
             newData.currentStage = activeTasks.map(t => t.stage).join(', ');
          } else if (holdTasks.length > 0) {
             newData.currentStage = 'Hold';
          } else if (completedTasks.length > 0) {
             const lastCompleted = [...newData.productionTasks].reverse().find(t => t.status === 'Completed');
             newData.currentStage = `${lastCompleted.stage} Done`;
          }

          if (newStatus === 'In Progress' || newStatus === 'Completed') {
            if (newData.currentStage !== 'Finished' && newData.status !== 'Hold' && (newData.status === 'Not Ready' || newData.status === 'Pending' || newData.status === 'Completed')) {
               newData.status = 'In Progress';
               newData.completedDate = null;
               if (!newData.startDate) newData.startDate = getIndianDate();
            }
          }

          newData.progress = calculateProgress(newData);
          newData.risk = calculateRisk(newData);

          if (!newData.activityHistory) newData.activityHistory = [];
          newData.activityHistory.push({
             stage: stageName,
             action: `Marked ${newStatus}`,
             timestamp: now
          });

          changedOrder = newData;
          return newData;
        }
        return o;
      });

      if (changedOrder && saveOrder) {
        if (pendingSaves.current[id]) clearTimeout(pendingSaves.current[id]);
        pendingSaves.current[id] = setTimeout(() => {
           saveOrder(changedOrder);
           delete pendingSaves.current[id];
        }, 800);
      }
      return updated;
    });
  };

  const [activeFilter, setActiveFilter] = useState('All')

  const displayOrders = orders.filter(o => {
    if (recentlyDeletedOrder && String(o.id) === String(recentlyDeletedOrder.id)) return false;
    if (o.status === 'Sold') return false;
    return true;
  });

  const filteredOrders = displayOrders.filter(o => {
    const matchesSearch = (o.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.product || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.id || '').toString().includes(searchQuery)
    if (!matchesSearch) return false;

    // 1. Status Filtering
    let matchesStatus = true
    if (activeFilter === 'Upcoming') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      matchesStatus = o.status !== 'Completed' && o.status !== 'Sold' && o.deliveryDate && new Date(o.deliveryDate) >= todayStart
    } else if (activeFilter === 'In Progress') {
      matchesStatus = o.status === 'In Progress' || o.status === 'Start'
    } else if (activeFilter === 'Completed') {
      matchesStatus = o.status === 'Completed'
    } else if (activeFilter === 'Not Ready') {
      matchesStatus = o.status === 'Not Ready' || o.status === 'Pending'
    } else if (Object.keys(PRODUCTION_STAGES).includes(activeFilter)) {
      matchesStatus = o.currentStage === activeFilter
    } else if (activeFilter === 'Due Today') {
      matchesStatus = o.deliveryDate === getIndianDate() && o.status !== 'Completed' && o.status !== 'Sold'
    } else if (activeFilter === 'Delayed') {
      matchesStatus = o.risk === 'Delayed' && o.status !== 'Completed' && o.status !== 'Sold'
    } else if (activeFilter === 'At Risk') {
      matchesStatus = o.risk === 'At Risk' && o.status !== 'Completed' && o.status !== 'Sold'
    } else if (activeFilter !== 'All') {
      matchesStatus = o.status === activeFilter
    }

    if (!matchesStatus) return false

    // 2. Date Filtering (Delivery Tracker)
    if (dateFilter !== 'All') {
      if (!o.deliveryDate) return false

      const todayStr = getIndianDate() // YYYY-MM-DD
      const targetStr = o.deliveryDate // Should be YYYY-MM-DD

      if (dateFilter === 'Today') {
        if (targetStr !== todayStr) return false
      } else if (dateFilter === 'Tomorrow') {
        const tom = new Date()
        tom.setDate(tom.getDate() + 1)
        const tomStr = tom.toISOString().split('T')[0]
        if (targetStr !== tomStr) return false
      } else if (dateFilter === 'Week') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const target = new Date(o.deliveryDate)
        target.setHours(0, 0, 0, 0)
        const nextWeek = new Date(today)
        nextWeek.setDate(today.getDate() + 7)
        if (target < today || target > nextWeek) return false
      } else if (dateFilter === 'Custom' && customDate) {
        if (targetStr !== customDate) return false
      }
    }

    return true
  })

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      // Keep 'Closed', 'Completed', and 'Sold' at the bottom regardless of sort
      const isFinishedA = a.status === 'Closed' || a.status === 'Completed' || a.status === 'Sold';
      const isFinishedB = b.status === 'Closed' || b.status === 'Completed' || b.status === 'Sold';
      if (isFinishedA && !isFinishedB) return 1;
      if (!isFinishedA && isFinishedB) return -1;

      let valA = a[sortConfig.key] || ''
      let valB = b[sortConfig.key] || ''

      if (sortConfig.key === 'updatedAt') {
        valA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.orderDate || 0).getTime()
        valB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.orderDate || 0).getTime()
      } else if (sortConfig.key === 'orderDate' || sortConfig.key === 'deliveryDate') {
        valA = new Date(valA || 0).getTime()
        valB = new Date(valB || 0).getTime()
      } else if (sortConfig.key === 'priority') {
        const pMap = { High: 3, Normal: 2, Low: 1 };
        valA = pMap[valA] || 2;
        valB = pMap[valB] || 2;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1

      // Fallback: If values are equal, sort by newest ID first
      const idA = Number(a.id) || 0
      const idB = Number(b.id) || 0
      return idB - idA
    });
  }, [filteredOrders, sortConfig]);

  // Scroll to highlight logic
  useEffect(() => {
    if (highlightOrderId) {
      // Clear filters to ensure the order is visible
      if (activeFilter !== 'All') setActiveFilter('All');
      if (dateFilter !== 'All') setDateFilter('All');
      if (searchQuery !== '') setSearchQuery('');

      // Use a timeout to allow state updates (filters) to apply and render
      setTimeout(() => {
        // Recalculate index based on the unfiltered orders
        const currentSorted = [...displayOrders].sort((a, b) => {
          // Keep 'Closed', 'Completed', and 'Sold' at the bottom regardless of sort
          const isFinishedA = a.status === 'Closed' || a.status === 'Completed' || a.status === 'Sold';
          const isFinishedB = b.status === 'Closed' || b.status === 'Completed' || b.status === 'Sold';
          if (isFinishedA && !isFinishedB) return 1;
          if (!isFinishedA && isFinishedB) return -1;
          let valA = a[sortConfig.key] || ''
          let valB = b[sortConfig.key] || ''
          if (sortConfig.key === 'updatedAt') {
            valA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.orderDate || 0).getTime()
            valB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.orderDate || 0).getTime()
          } else if (sortConfig.key === 'orderDate' || sortConfig.key === 'deliveryDate') {
            valA = new Date(valA || 0).getTime()
            valB = new Date(valB || 0).getTime()
          } else if (sortConfig.key === 'priority') {
            const pMap = { High: 3, Normal: 2, Low: 1 };
            valA = pMap[valA] || 2;
            valB = pMap[valB] || 2;
          }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1

          const idA = Number(a.id) || 0
          const idB = Number(b.id) || 0
          return idB - idA
        });

        const index = currentSorted.findIndex(o => String(o.id) === String(highlightOrderId));
        if (index !== -1) {
          const page = Math.floor(index / itemsPerPage) + 1;
          setCurrentPageNum(page);

          // Wait for pagination to render
          setTimeout(() => {
            const row = rowRefs.current[highlightOrderId] || rowRefs.current[String(highlightOrderId)] || rowRefs.current[Number(highlightOrderId)];
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Keep highlight for 3 seconds then clear
              setTimeout(() => {
                if (setHighlightOrderId) setHighlightOrderId(null);
              }, 3000);
            }
          }, 500);
        }
      }, 100);
    }
  }, [highlightOrderId, orders, recentlyDeletedOrder, sortConfig]);

  // Reset pagination to page 1 when search or filters change
  useEffect(() => {
    setCurrentPageNum(1)
    setMobileVisibleCount(5)
  }, [searchQuery, activeFilter, dateFilter])

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)

  useEffect(() => {
    if (totalPages > 0 && currentPageNum > totalPages) {
      setCurrentPageNum(totalPages)
    }
  }, [totalPages, currentPageNum])

  // Keep the viewOrder popup in sync with any background updates
  useEffect(() => {
    if (viewOrder) {
      const updatedOrder = orders.find(o => o.id === viewOrder.id);
      if (updatedOrder && JSON.stringify(updatedOrder) !== JSON.stringify(viewOrder)) {
        setViewOrder(updatedOrder);
      }
    }
  }, [orders, viewOrder]);

  const paginatedOrders = sortedOrders.slice((currentPageNum - 1) * itemsPerPage, currentPageNum * itemsPerPage)

  const getProgress = (order) => {
    return calculateProgress(order);
  }

  const totalOrders = displayOrders.length
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const upcomingDeliveries = displayOrders.filter(o => o.status !== 'Closed' && o.status !== 'Sold' && o.deliveryDate && new Date(o.deliveryDate) >= todayStart).length
  const pendingCount = displayOrders.filter(o => o.status === 'Not Ready' || o.status === 'Pending').length
  const progressCount = displayOrders.filter(o => o.status === 'In Progress' || o.status === 'Start').length
  const holdCount = displayOrders.filter(o => o.status === 'Hold').length
  const closedCount = displayOrders.filter(o => o.status === 'Completed' || o.status === 'Sold').length

  const handlePrintReceipt = () => {
    const originalElement = document.getElementById('receipt-content');
    if (!originalElement) return;

    // Create a clone and convert it to an HTML string with display: block.
    // Passing a raw string to html2pdf completely avoids all DOM constraints, 
    // scroll offset issues, and blank page bugs while preventing any UI breaks.
    const clone = originalElement.cloneNode(true);
    clone.style.display = 'block';
    clone.style.width = '800px'; // Force exact width to prevent right-side clipping
    const htmlString = clone.outerHTML;

    const opt = {
      margin: [10, 0, 10, 0], // Remove left/right margins so it fits the A4 width perfectly
      filename: `Receipt_Order_${viewOrder.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlString).save().then(() => {
      if (showGlobalToast) showGlobalToast('Success', 'Receipt downloaded successfully');

      // Redirect to WhatsApp
      const client = (clients || []).find(c => c.name === viewOrder.clientName);
      const phoneToUse = client?.mobile || viewOrder.clientPhone || '';
      let formattedPhone = String(phoneToUse).replace(/\D/g, '');
      if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

      const receiptUrl = `https://erp.malka.co.in/?bill=${encryptId(viewOrder.id)}`;
      const msg = `Hello ${viewOrder.clientName || 'Valued Client'},\n\nThank you for choosing Malka! Your order receipt has been generated.\n\nYou can view and download your digital receipt here:\n${receiptUrl}\n\nPlease let us know if you have any questions!`;

      const whatsappUrl = formattedPhone
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      window.open(whatsappUrl, '_blank');
    }).catch((err) => {
      console.error("PDF generation failed:", err);
    });
  };

  return (
    <div style={themeStyle} className="relative">

      {recentlyDeletedOrder && (
        <UndoToast
          message="Deleted Order"
          highlight={`#${recentlyDeletedOrder.id}`}
          onUndo={handleUndoDelete}
          onClose={() => { setRecentlyDeletedOrder(null); if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); }}
        />
      )}

      {viewOrder && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="absolute top-4 right-4 flex items-center gap-3">
              <button className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:brightness-95 transition text-sm font-semibold shadow-sm" onClick={handlePrintReceipt}>
                <Eye size={16} /> View Details
              </button>
              <button className="text-[var(--muted)] hover:text-[var(--text)] transition p-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg" onClick={() => setViewOrder(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6 mt-4">
              <img src="/logo-black.png" alt="Logo" className="w-16 h-16 object-contain" />
              <div>
                <h2 className="text-2xl font-semibold flex items-center gap-2">Order #{viewOrder.id}</h2>
                <p className="text-sm text-[var(--muted)]">Malka</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Client Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-center">
                <p className="text-xs font-medium text-[var(--muted)] mb-1.5">Client Name</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-sm font-semibold text-[var(--text)] border border-[var(--border)]">
                    {viewOrder.clientName?.charAt(0)?.toUpperCase()}
                  </div>
                  <p className="font-semibold text-[var(--text)] text-base truncate">{viewOrder.clientName}</p>
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-center">
                <p className="text-xs font-medium text-[var(--muted)] mb-2">Order Status</p>
                <div className="flex items-center">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium border
                    ${viewOrder.status === 'Completed' || viewOrder.status === 'Sold' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      viewOrder.status === 'In Progress' || viewOrder.status === 'Start' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        viewOrder.status === 'Hold' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-[var(--surface-strong)] text-[var(--text)] border-[var(--border)]'
                    }`}>
                    {viewOrder.status === 'Pending' ? 'Not Ready' : (viewOrder.status || 'Not Ready')}
                  </span>
                </div>
              </div>

              {/* Product Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-center">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">Product Details</p>
                <p className="font-semibold text-[var(--text)] text-sm">{viewOrder.product}</p>
                <p className="text-[13px] text-[var(--muted)] mt-0.5">{viewOrder.orderType} <span className="opacity-40 mx-1.5">â€¢</span> â‚¹{viewOrder.price}</p>

                <div className="flex flex-wrap items-center gap-3 mt-2.5">
                  {viewOrder.advance > 0 && <span className="text-[11px] text-[var(--muted)] bg-[var(--surface-strong)] px-2 py-0.5 rounded-md border border-[var(--border)]">Adv: <span className="text-emerald-600 font-medium">â‚¹{viewOrder.advance}</span> <span className="opacity-40 mx-1">â€¢</span> Bal: <span className="font-medium">â‚¹{(parseFloat(viewOrder.price || 0) - parseFloat(viewOrder.advance || 0)).toFixed(2)}</span></span>}
                  {viewOrder.size && <span className="text-[11px] text-[var(--muted)] bg-[var(--surface-strong)] px-2 py-0.5 rounded-md border border-[var(--border)]">Qty: <span className="font-medium text-[var(--text)]">{viewOrder.size}</span></span>}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border border-[var(--border)] ${
                    viewOrder.priority === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
                    viewOrder.priority === 'Low' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                    'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>Priority: {viewOrder.priority || 'Normal'}</span>
                </div>
              </div>

              {/* Material Details Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-start">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">Material Source</p>
                <p className="text-sm font-semibold text-[var(--text)]">{viewOrder.sourceOfMaterial || 'Outside'}</p>

                {viewOrder.sourceOfMaterial === 'Internal' && viewOrder.internalItems && viewOrder.internalItems.length > 0 && (
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    <div className="border-l-2 border-[var(--border)] pl-3 py-1 space-y-1.5">
                      {viewOrder.internalItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span>{item.quantity}x {item.productName}</span>
                          <span className="text-[var(--text)] font-medium">â‚¹{(item.totalPrice || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-2.5 pl-3 font-medium text-[var(--text)]">
                      <span>Total Material</span>
                      <span>â‚¹{viewOrder.internalItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              {viewOrder.notes && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-[var(--muted)] mb-1">Notes</p>
                  <p className="text-sm text-[var(--text)] bg-[var(--soft)] p-3 rounded-xl">{viewOrder.notes}</p>
                </div>
              )}

              {(() => {
                const clientObj = (clients || []).find(c => c.name?.toLowerCase().trim() === viewOrder.clientName?.toLowerCase().trim());
                const matchMeasure = clientObj?.measurements?.find(m => m.product?.toLowerCase().trim() === viewOrder.product?.toLowerCase().trim());
                if (!matchMeasure) return null;

                const topData = [];
                const bottomData = [];
                const otherData = [];

                if (matchMeasure.topMeasurements) {
                  Object.keys(matchMeasure.topMeasurements).forEach(k => {
                    const val = matchMeasure.topMeasurements[k];
                    if (val && typeof val === 'string' && val.trim() !== '') {
                      topData.push({ key: k, value: val });
                    }
                  });
                }
                if (matchMeasure.bottomMeasurements) {
                  Object.keys(matchMeasure.bottomMeasurements).forEach(k => {
                    const val = matchMeasure.bottomMeasurements[k];
                    if (val && typeof val === 'string' && val.trim() !== '') {
                      bottomData.push({ key: k, value: val });
                    }
                  });
                }

                // If old format or flat measurements exist
                Object.keys(matchMeasure).forEach(k => {
                  if (!['id', 'product', 'note', 'notes', 'timestamp', 'createdAt', 'topMeasurements', 'bottomMeasurements'].includes(k)) {
                    const val = matchMeasure[k];
                    if (val && typeof val === 'string' && val.trim() !== '') {
                      otherData.push({ key: k, value: val });
                    }
                  }
                });

                const totalItems = topData.length + bottomData.length + otherData.length;
                if (totalItems === 0) return null;

                const formatKey = (str) => {
                  return str.replace(/([A-Z])/g, ' $1').trim();
                };

                const renderSection = (title, data) => {
                  if (data.length === 0) return null;
                  return (
                    <div className="mb-4 last:mb-0">
                      <h4 className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-2.5 pb-1 border-b border-[var(--border)]">{title}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {data.map((item, idx) => (
                          <div key={idx} className="flex flex-col justify-center bg-[var(--surface-strong)] p-2.5 rounded-lg border border-[var(--border)] shadow-sm">
                            <span className="text-[10px] font-bold text-[var(--muted)] leading-tight uppercase mb-0.5">{formatKey(item.key)}</span>
                            <span className="text-sm font-black text-[var(--text)]">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="col-span-2">
                    <button
                      onClick={() => setShowMeasurements(!showMeasurements)}
                      className="w-full flex items-center justify-between bg-[var(--soft)] p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition"
                    >
                      <p className="text-sm font-medium text-[var(--text)] flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M4 14l6-6 4 4 6-6" /><path d="M22 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8" /></svg>
                        Client Measurements ({totalItems})
                      </p>
                      {showMeasurements ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
                    </button>
                    {showMeasurements && (
                      <div className="bg-[var(--soft)] p-4 rounded-xl border border-[var(--border)] mt-2">
                        {renderSection('Top Measurements', topData)}
                        {renderSection('Bottom Measurements', bottomData)}
                        {renderSection('Other Details', otherData)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {viewOrder.audioNote && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-[var(--muted)] mb-1 flex items-center gap-2">
                    <Play size={14} className="text-[var(--accent)]" /> Voice Note
                  </p>
                  <audio controls src={viewOrder.audioNote} className="w-full h-10 rounded-xl outline-none" />
                </div>
              )}

              <div className="flex flex-wrap gap-4 mt-6">
                {viewOrder.photo && (
                  <div>
                    <p className="text-sm font-medium text-[var(--muted)] mb-1">Design Reference</p>
                    <img src={viewOrder.photo} alt="Ref" className="h-24 w-24 rounded-xl object-cover border border-[var(--border)] cursor-pointer hover:opacity-80 transition" onClick={() => setImagePopup(viewOrder.photo)} />
                  </div>
                )}

                {viewOrder.materialPhoto && (
                  <div>
                    <p className="text-sm font-medium text-[var(--muted)] mb-1">Material Photo</p>
                    <img src={viewOrder.materialPhoto} alt="Mat" className="h-24 w-24 rounded-xl object-cover border border-[var(--border)] cursor-pointer hover:opacity-80 transition" onClick={() => setImagePopup(viewOrder.materialPhoto)} />
                  </div>
                )}

                {viewOrder.measurementPhotoUrl && (
                  <div>
                    <p className="text-sm font-medium text-[var(--muted)] mb-1">Measurement Photo</p>
                    <img src={viewOrder.measurementPhotoUrl} alt="Meas" className="h-24 w-24 rounded-xl object-cover border border-[var(--border)] cursor-pointer hover:opacity-80 transition" onClick={() => setImagePopup(viewOrder.measurementPhotoUrl)} />
                  </div>
                )}
              </div>

              <div className="col-span-2 bg-[var(--soft)] p-5 rounded-2xl border border-[var(--border)] shadow-inner">
                <div className="flex justify-between items-center mb-6 border-b border-[var(--border)] pb-2">
                  <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> Production Timeline
                  </p>
                  <span className="text-[10px] font-bold text-[var(--text)]">{getProgress(viewOrder)}% Complete</span>
                </div>
                <div className="relative flex flex-col gap-4 w-full pl-2">
                  {/* Vertical connecting line */}
                  <div className="absolute top-2 bottom-2 left-6 w-0.5 bg-[var(--border)] z-0"></div>

                  <div className="relative z-10 flex items-center gap-4 w-full">
                    <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-[var(--soft)]">
                      <CalendarDays size={14} />
                    </div>
                    <div className="flex flex-col flex-1 bg-[var(--surface-strong)] p-3 rounded-xl border border-[var(--border)]">
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Ordered</span>
                      <span className="text-sm font-black text-[var(--text)] mt-0.5">{viewOrder.orderDate || 'N/A'}</span>
                    </div>
                  </div>

                  {viewOrder.productionTasks?.map((task, idx) => (
                    <div key={idx} className={`relative z-10 flex items-center gap-4 w-full ${task.status === 'Pending' ? 'opacity-50' : ''}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md ring-4 ring-[var(--soft)] transition-colors ${task.status === 'Completed' ? 'bg-emerald-500 text-white' : task.status === 'In Progress' ? 'bg-indigo-500 text-white' : 'bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--border)]'}`}>
                        {task.status === 'Completed' ? <CheckCircle2 size={14} /> : task.status === 'In Progress' ? <Play size={14} /> : <div className="h-2 w-2 rounded-full bg-[var(--muted)]" />}
                      </div>
                      <div className="flex flex-col flex-1 bg-[var(--surface-strong)] p-3 rounded-xl border border-[var(--border)]">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">{task.stage}</span>
                          <span className={`text-[10px] font-bold ${task.status === 'Completed' ? 'text-emerald-500' : task.status === 'In Progress' ? 'text-indigo-500' : 'text-[var(--muted)]'}`}>{task.status}</span>
                        </div>
                        {task.completedAt && <span className="text-[10px] text-[var(--muted)] mt-1">Completed: {formatDateDDMMYY(task.completedAt)}</span>}
                        {task.status === 'In Progress' && task.startedAt && <span className="text-[10px] text-[var(--muted)] mt-1">Started: {formatDateDDMMYY(task.startedAt)}</span>}
                      </div>
                    </div>
                  ))}

                  <div className={`relative z-10 flex items-center gap-4 w-full ${viewOrder.completedDate || viewOrder.status === 'Completed' || viewOrder.status === 'Sold' ? '' : 'opacity-50'}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md ring-4 ring-[var(--soft)] transition-colors ${viewOrder.completedDate || viewOrder.status === 'Completed' || viewOrder.status === 'Sold' ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--border)]'}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className="flex flex-col flex-1 bg-[var(--surface-strong)] p-3 rounded-xl border border-[var(--border)]">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Delivery / Ready</span>
                        <span className={`text-[10px] font-bold ${viewOrder.risk === 'Delayed' ? 'text-red-500' : viewOrder.risk === 'At Risk' ? 'text-orange-500' : 'text-emerald-500'}`}>{viewOrder.risk || 'On Track'}</span>
                      </div>
                      <span className="text-sm font-black text-[var(--text)] mt-0.5">{viewOrder.deliveryDate || 'N/A'}</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-end">
              <div className="text-[10px] text-[var(--muted)] font-medium leading-tight">
                <p>Created By: <span className="font-bold text-[var(--text)]">{viewOrder.createdBy || 'Admin'}</span></p>
                <p>Created At: <span className="font-bold text-[var(--text)]">{viewOrder.createdAt ? new Date(viewOrder.createdAt).toLocaleString('en-IN', { hour12: true, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (viewOrder.orderDate || 'N/A')}</span></p>
              </div>
              <button type="button" className="rounded-xl border border-[var(--border)] px-6 py-2.5 font-semibold hover:bg-[var(--soft)] transition" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>

          {/* Hidden Receipt Element for PDF Generation (Moved outside max-w-lg container to prevent clipping) */}
          <div id="receipt-content" style={{ display: 'none' }}>
            <div style={{ padding: '40px', fontFamily: '"Inter", sans-serif', color: '#1f2937', backgroundColor: '#fff', width: '800px', boxSizing: 'border-box', margin: '0 auto' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f3f4f6', paddingBottom: '30px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <img src="/logo-black.png" alt="Logo" style={{ width: '80px', height: '85px', objectFit: 'contain' }} />
                  <div>
                    <h1 style={{ margin: 0, fontSize: '32px', color: '#111827', fontWeight: '800', letterSpacing: '-0.5px' }}>Malka</h1>
                    <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#6b7280' }}>Be Unique, Be Malka</p>

                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#111827', fontWeight: '700', letterSpacing: '2px' }}>INVOICE</h2>
                  <p style={{ margin: '8px 0 0 0', fontSize: '15px', color: '#4b5563', fontWeight: '600' }}>Order #{viewOrder.id}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>Date: {viewOrder.orderDate ? formatDateDDMMYY(viewOrder.orderDate) : 'N/A'}</p>
                </div>
              </div>

              {/* Client & Delivery Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px', fontWeight: '600' }}>Billed To:</h3>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '20px', color: '#111827' }}>{viewOrder.clientName}</p>
                </div>
                <div style={{ flex: 1, paddingLeft: '20px', borderLeft: '2px solid #f3f4f6' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px', fontWeight: '600' }}>Delivery Information:</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#4b5563' }}>Expected Delivery: <span style={{ fontWeight: '600', color: '#111827' }}>{viewOrder.deliveryDate ? formatDateDDMMYY(viewOrder.deliveryDate) : 'N/A'}</span></p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '15px', color: '#4b5563' }}>Material Source: <span style={{ fontWeight: '600', color: '#111827' }}>{viewOrder.sourceOfMaterial || 'Outside'}</span></p>
                </div>
              </div>

              {/* Order Details Table */}
              <div style={{ marginBottom: '40px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 15px', borderTop: '2px solid #111827', borderBottom: '2px solid #111827', color: '#111827', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                      <th style={{ padding: '12px 15px', borderTop: '2px solid #111827', borderBottom: '2px solid #111827', color: '#111827', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                      <th style={{ padding: '12px 15px', borderTop: '2px solid #111827', borderBottom: '2px solid #111827', color: '#111827', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '12px 15px', borderTop: '2px solid #111827', borderBottom: '2px solid #111827', color: '#111827', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #e5e7eb', fontSize: '16px', fontWeight: '600', color: '#111827' }}>{viewOrder.product}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #e5e7eb', fontSize: '15px', color: '#4b5563' }}>{viewOrder.orderType || '-'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #e5e7eb', fontSize: '15px', color: '#4b5563', textAlign: 'center' }}>{viewOrder.size || '1'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #e5e7eb', fontSize: '16px', fontWeight: '600', color: '#111827', textAlign: 'right' }}>â‚¹{parseFloat(viewOrder.price || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '50px' }}>
                <div style={{ width: '380px', padding: '25px 15px 0 15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px' }}>
                    <span style={{ color: '#4b5563' }}>Subtotal:</span>
                    <span style={{ fontWeight: '600', color: '#111827' }}>â‚¹{parseFloat(viewOrder.price || 0).toFixed(2)}</span>
                  </div>
                  {viewOrder.advance > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px' }}>
                      <span style={{ color: '#4b5563' }}>Advance Paid:</span>
                      <span style={{ fontWeight: '600', color: '#059669' }}>- â‚¹{parseFloat(viewOrder.advance || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #111827', fontSize: '22px' }}>
                    <span style={{ fontWeight: '800', color: '#111827' }}>Balance Due:</span>
                    <span style={{ fontWeight: '800', color: '#111827' }}>â‚¹{(parseFloat(viewOrder.price || 0) - parseFloat(viewOrder.advance || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', borderTop: '2px solid #f3f4f6', paddingTop: '30px', color: '#6b7280' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>Thank you for choosing Malka!</p>
                <p style={{ margin: 0, fontSize: '14px' }}>If you have any questions concerning this invoice, please contact us.</p>
                <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>This is a computer-generated document and does not require a signature.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <Trash2 size={24} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Delete Order</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Are you sure you want to delete order #{orderToDelete.id}? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button type="button" className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold hover:bg-[var(--soft)] transition" onClick={() => setOrderToDelete(null)}>Cancel</button>
              <button type="button" className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white shadow-lg transition hover:brightness-95" onClick={handleDeleteConfirm}>Delete Order</button>
            </div>
          </div>
        </div>
      )}

      {editOrder && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Edit Order #{editOrder.id}</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">Client Name</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                  value={editOrder.clientName}
                  onChange={(e) => setEditOrder({ ...editOrder, clientName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">Product</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                  value={editOrder.product}
                  onChange={(e) => setEditOrder({ ...editOrder, product: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-4">
                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Order Type</span>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.orderType || ''}
                    onChange={(e) => setEditOrder({ ...editOrder, orderType: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Quantity</span>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.size || ''}
                    onChange={(e) => setEditOrder({ ...editOrder, size: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Est. Cost</span>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.price || ''}
                    onChange={(e) => setEditOrder({ ...editOrder, price: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-4">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Advance Paid</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-green-600 font-semibold"
                      value={editOrder.advance || ''}
                      onChange={(e) => setEditOrder({ ...editOrder, advance: e.target.value })}
                    />
                    <select
                      className="w-[100px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs outline-none transition focus:border-[var(--accent)] cursor-pointer"
                      value={editOrder.paymentMode || 'Cash'}
                      onChange={(e) => setEditOrder({ ...editOrder, paymentMode: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">Material Source</span>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                  value={editOrder.sourceOfMaterial || 'Outside'}
                  onChange={(e) => setEditOrder({ ...editOrder, sourceOfMaterial: e.target.value })}
                >
                  <option value="Outside">Client Provided</option>
                  <option value="Internal">Studio Inventory</option>
                </select>
              </label>

              {editOrder.sourceOfMaterial === 'Internal' && editOrder.internalItems && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] overflow-hidden mb-4">
                  <div className="bg-[var(--soft)] px-3 py-2 border-b border-[var(--border)] flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Internal Materials</span>
                    <span className="text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded-full">{editOrder.internalItems.length} Items</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {editOrder.internalItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                        <span className="font-semibold text-[var(--text)] truncate mr-2">{item.productName} <span className="text-[var(--muted)] font-normal">(x{item.quantity})</span></span>
                        <span className="font-bold text-[var(--accent)] whitespace-nowrap">â‚¹{(item.totalPrice || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Order Status</span>
                  <select
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.status || 'Not Ready'}
                    onChange={(e) => setEditOrder({ ...editOrder, status: e.target.value })}
                  >
                    <option value="Not Ready">Not Ready</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Sold">Sold</option>
                  </select>
                </label>
                <div className="block col-span-1">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Production Stages</span>
                  <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 space-y-1 h-[80px] overflow-y-auto custom-scrollbar">
                    {(!editOrder.workflow || editOrder.workflow.length === 0) && (
                      <span className="text-xs text-[var(--muted)] px-2">No stages.</span>
                    )}
                    {(editOrder.workflow || []).map(stage => {
                      const task = (editOrder.productionTasks || []).find(t => t.stage === stage) || { status: 'Pending' };
                      let disableCompletedButton = false;
                      if (stage === 'Finished') {
                        const workflow = editOrder.workflow || [];
                        disableCompletedButton = workflow.some(s => {
                          if (s === 'Finished') return false;
                          const t = (editOrder.productionTasks || []).find(pt => pt.stage === s);
                          if (s === 'Handwork') {
                            if (!t || t.status === 'Pending') return false;
                          }
                          return !t || t.status !== 'Completed';
                        });
                      }
                      return (
                        <div key={stage} className="flex items-center justify-between px-2 py-1 hover:bg-[var(--soft)] rounded transition">
                          <span className="font-medium text-[var(--text)] text-xs truncate max-w-[100px]" title={stage}>{stage}</span>
                          <div className="flex bg-[var(--surface-strong)] rounded-md border border-[var(--border)] overflow-hidden flex-shrink-0">
                            <button 
                              title="Pending"
                              onClick={() => {
                                const newTasks = (editOrder.productionTasks || editOrder.workflow.map(s => ({ stage: s, status: 'Pending' }))).map(t => 
                                  t.stage === stage ? { ...t, status: 'Pending', completedAt: null, startedAt: null } : t
                                );
                                setEditOrder({ ...editOrder, productionTasks: newTasks });
                              }}
                              className={`p-1 transition ${task.status === 'Pending' ? 'bg-[var(--soft)] text-[var(--muted)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                            >
                              <Clock size={12} />
                            </button>
                            <button 
                              title="In Progress"
                              onClick={() => {
                                const newTasks = (editOrder.productionTasks || editOrder.workflow.map(s => ({ stage: s, status: 'Pending' }))).map(t => 
                                  t.stage === stage ? { ...t, status: 'In Progress', startedAt: t.startedAt || new Date().toISOString(), completedAt: null } : t
                                );
                                setEditOrder({ ...editOrder, productionTasks: newTasks });
                              }}
                              className={`p-1 transition ${task.status === 'In Progress' ? 'bg-orange-500/20 text-orange-500' : 'text-[var(--muted)] hover:text-orange-500'}`}
                            >
                              <Play size={12} />
                            </button>
                            <button 
                              title={disableCompletedButton ? "Complete all other tasks first" : "Completed"}
                              onClick={() => {
                                if (disableCompletedButton) return;
                                const newTasks = (editOrder.productionTasks || editOrder.workflow.map(s => ({ stage: s, status: 'Pending' }))).map(t => 
                                  t.stage === stage ? { ...t, status: 'Completed', startedAt: t.startedAt || new Date().toISOString(), completedAt: new Date().toISOString() } : t
                                );
                                setEditOrder({ ...editOrder, productionTasks: newTasks });
                              }}
                              className={`p-1 transition ${task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : disableCompletedButton ? 'text-[var(--muted)] opacity-50 cursor-not-allowed' : 'text-[var(--muted)] hover:text-emerald-500'}`}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Order Date</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.orderDate}
                    onChange={(e) => setEditOrder({ ...editOrder, orderDate: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--text)]">Delivery Date</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                    value={editOrder.deliveryDate}
                    onChange={(e) => setEditOrder({ ...editOrder, deliveryDate: e.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">Notes</span>
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)] min-h-[100px]"
                  value={editOrder.notes || ''}
                  onChange={(e) => setEditOrder({ ...editOrder, notes: e.target.value })}
                  placeholder="Fitting adjustments, fabric details, or special requests..."
                />
              </label>

              <div className="pt-2">
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">Update Design Reference Photo</span>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] flex items-center justify-center overflow-hidden">
                    {editOrder.photo ? (
                      <img src={editOrder.photo} alt="Current" className="h-full w-full object-cover" />
                    ) : (
                      <Plus size={24} className="text-[var(--muted)]" />
                    )}
                  </div>
                  <label className="flex-1">
                    <div className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 text-xs font-bold text-[var(--accent)] transition hover:brightness-95 active:scale-95">
                      <Plus size={16} /> {editOrder.photo ? 'Change Design Reference' : 'Upload Design Reference'}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setEditOrder({ ...editOrder, photo: ev.target.result });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {editOrder.photo && (
                    <button
                      type="button"
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      onClick={() => setEditOrder({ ...editOrder, photo: null })}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-xl px-4 py-2 font-semibold hover:bg-[var(--soft)] transition" onClick={() => setEditOrder(null)}>Cancel</button>
              <button type="button" className="rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white shadow-lg transition hover:brightness-95" onClick={async () => {
                let finalOrder = { ...editOrder, updatedAt: new Date().toISOString() }
                const originalOrder = orders.find(o => o.id === finalOrder.id);
                
                // Auto-apply logic if status was modified via Edit popup
                if (originalOrder && originalOrder.status !== finalOrder.status) {
                    if (finalOrder.status === 'In Progress' && !finalOrder.startDate) {
                        finalOrder.startDate = getIndianDate();
                    }
                    if (finalOrder.status === 'Completed' || finalOrder.status === 'Sold') {
                        if (!finalOrder.completedDate) finalOrder.completedDate = getIndianDate();
                        if (!finalOrder.startDate) finalOrder.startDate = getIndianDate();
                        finalOrder.currentStage = 'Finished';
                        if (finalOrder.productionTasks) {
                            finalOrder.productionTasks = finalOrder.productionTasks.map(task => ({
                                ...task, status: 'Completed', completedAt: task.completedAt || new Date().toISOString(), startedAt: task.startedAt || new Date().toISOString()
                            }));
                        }
                    }
                    if (finalOrder.status === 'Not Ready' || finalOrder.status === 'Pending') {
                      finalOrder.startDate = null;
                      finalOrder.completedDate = null;
                      finalOrder.currentStage = 'Not Started';
                      if (finalOrder.productionTasks) {
                        finalOrder.productionTasks = finalOrder.productionTasks.map(task => ({
                          ...task, status: 'Pending', completedAt: null, startedAt: null
                        }));
                      }
                    }
                    if (finalOrder.status !== 'Hold') {
                      finalOrder.lastActiveStatus = finalOrder.status;
                    }
                }

                // Derive currentStage based on the modified tasks in the popup
                if (finalOrder.productionTasks && finalOrder.workflow) {
                   const activeTasks = finalOrder.productionTasks.filter(t => t.status === 'In Progress');
                   if (finalOrder.productionTasks.every(t => t.status === 'Completed')) {
                      finalOrder.currentStage = 'Finished';
                      finalOrder.status = 'Completed';
                      if (!finalOrder.completedDate) finalOrder.completedDate = getIndianDate();
                   } else if (finalOrder.productionTasks.every(t => t.status === 'Pending')) {
                      finalOrder.currentStage = 'Not Started';
                   } else if (activeTasks.length > 0) {
                      finalOrder.currentStage = activeTasks.map(t => t.stage).join(', ');
                   }
                   
                   if (finalOrder.currentStage !== 'Finished' && (finalOrder.status === 'Not Ready' || finalOrder.status === 'Pending' || finalOrder.status === 'Completed')) {
                      finalOrder.status = 'In Progress';
                      finalOrder.completedDate = null;
                      if (!finalOrder.startDate) finalOrder.startDate = getIndianDate();
                   }
                   
                   finalOrder.progress = calculateProgress(finalOrder);
                   finalOrder.risk = calculateRisk(finalOrder);
                }

                saveOrders(orders.map(o => o.id === finalOrder.id ? finalOrder : o))
                if (saveOrder) saveOrder(finalOrder)
                
                // Sync advance update to Accounts
                const advanceAmount = parseFloat(finalOrder.advance) || 0;
                const ref = `Order Advance #${finalOrder.id}`;
                if (advanceAmount > 0) {
                  const { data: existing } = await supabase.from('erp_accounts').select('id').eq('reference', ref).single();
                  if (existing) {
                    await supabase.from('erp_accounts').update({
                      amount: advanceAmount,
                      payment_mode: finalOrder.paymentMode || 'Cash',
                      date: finalOrder.orderDate || getIndianDate()
                    }).eq('id', existing.id);
                  } else {
                    await supabase.from('erp_accounts').insert([{
                      type: 'Income',
                      date: finalOrder.orderDate || getIndianDate(),
                      category: 'Order Advance',
                      amount: advanceAmount,
                      payment_mode: finalOrder.paymentMode || 'Cash',
                      reference: ref,
                      notes: `Advance for ${finalOrder.product} (${finalOrder.clientName})`
                    }]);
                  }
                } else {
                  await supabase.from('erp_accounts').delete().eq('reference', ref);
                }

                setEditOrder(null)
                if (showGlobalToast) showGlobalToast('Success', 'Order updated successfully.')
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showWaPopup && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-[#25D366] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Send WhatsApp Message
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">Send a delivery confirmation to <strong>{waData.name}</strong>.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">WhatsApp Number</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)]"
                  value={waData.phone}
                  onChange={(e) => setWaData({ ...waData, phone: e.target.value })}
                  placeholder="e.g. 919876543210"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">Message</span>
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 outline-none transition focus:border-[var(--accent)] text-[var(--text)] min-h-[120px] resize-none"
                  value={waData.message}
                  onChange={(e) => setWaData({ ...waData, message: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-xl px-4 py-2 font-semibold hover:bg-[var(--soft)] transition" onClick={() => setShowWaPopup(false)}>Cancel</button>
              <button type="button" className="rounded-xl bg-[#25D366] px-4 py-2 font-semibold text-white shadow-lg transition hover:brightness-95 flex items-center gap-2" onClick={() => {
                if (waData.phone) {
                  let finalPhone = waData.phone.replace(/\D/g, '');
                  const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(waData.message)}`;
                  window.open(url, '_blank');
                } else {
                  if (showGlobalToast) showGlobalToast('Error', 'Please enter a valid WhatsApp number');
                  return;
                }
                setShowWaPopup(false);
              }}>
                Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-h1">Orders History</h1>
          <p className="text-para text-[var(--muted)] mt-2">View and manage all active studio orders.</p>
        </div>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-95 active:scale-95"
          onClick={() => setCurrentPage('add-order')}
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add New Order</span>
          <span className="sm:hidden">Add Order</span>
        </button>
      </div>

      {/* Mobile Stats Select */}
      <div className="mb-6 lg:hidden">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2 block">Quick Filter</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm font-semibold outline-none focus:border-[var(--accent)]"
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setCurrentPageNum(1);
            document.getElementById('orders-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {[
            { id: 'All', label: 'Total Orders' },
            { id: 'Upcoming', label: 'Upcoming Delivery' },
            { id: 'Not Ready', label: 'Not Ready' },
            { id: 'In Progress', label: 'In Progress' },
            { id: 'Hold', label: 'On Hold' },
            { id: 'Completed', label: 'Completed' },
          ].concat(Object.keys(PRODUCTION_STAGES).map(stage => ({ id: stage, label: stage }))).map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
      {/* Master Stats Dashboard */}
      <div className="mb-6 hidden lg:grid gap-4 xl:grid-cols-7 lg:gap-4">
        {[
          { id: 'All', label: 'Total', value: totalOrders, icon: ClipboardList, color: 'text-stone-700', bgColor: 'bg-stone-50' },
          { id: 'Due Today', label: 'Due Today', value: displayOrders.filter(o => o.deliveryDate === getIndianDate() && o.status !== 'Completed' && o.status !== 'Sold').length, icon: CalendarDays, color: 'text-rose-600', bgColor: 'bg-rose-50' },
          { id: 'Delayed', label: 'Delayed', value: displayOrders.filter(o => o.risk === 'Delayed' && o.status !== 'Completed' && o.status !== 'Sold').length, icon: Clock, color: 'text-red-600', bgColor: 'bg-red-50' },
          { id: 'At Risk', label: 'At Risk', value: displayOrders.filter(o => o.risk === 'At Risk' && o.status !== 'Completed' && o.status !== 'Sold').length, icon: Pause, color: 'text-orange-600', bgColor: 'bg-orange-50' },
          { id: 'In Progress', label: 'In Progress', value: progressCount, icon: Play, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
          { id: 'Hold', label: 'Hold', value: holdCount, icon: Pause, color: 'text-amber-600', bgColor: 'bg-amber-50' },
          { id: 'Completed', label: 'Completed', value: displayOrders.filter(o => o.status === 'Completed').length, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
        ].map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => {
              setActiveFilter(stat.id)
              setCurrentPageNum(1)
              document.getElementById('orders-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`group relative flex flex-col items-center justify-center rounded-[24px] border p-4 transition-all duration-300 hover:shadow-lg active:scale-95 ${activeFilter === stat.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-md scale-[1.02]' : 'border-[var(--border)] bg-[var(--surface-strong)] hover:border-[var(--accent)]/30'}`}
          >
            <div className={`mb-3 rounded-2xl p-2.5 transition-colors ${activeFilter === stat.id ? 'bg-[var(--accent)] text-white' : stat.bgColor + ' ' + stat.color}`}>
              <stat.icon size={22} />
            </div>
            <p className={`text-2xl font-black transition-colors ${activeFilter === stat.id ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{stat.value}</p>
            <p className="mt-1 font-black uppercase tracking-[0.15em] text-[var(--muted)] group-hover:text-[var(--text)] transition-colors !text-[10px] whitespace-nowrap">{stat.label}</p>
            {activeFilter === stat.id && (
              <div className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--accent)]"></div>
            )}
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md flex-1">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--muted)] shadow-sm focus-within:border-[var(--accent)] transition-colors">
              <Search size={18} />
              <input
                className="w-full bg-transparent outline-none placeholder:text-stone-400 font-medium"
                placeholder="Search client, product or ID..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[140px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Order Status</span>
              <div className="relative group">
                <select
                  className="relative z-10 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 pr-10 text-[11px] font-bold outline-none transition cursor-pointer hover:border-[var(--accent)] h-11"
                  value={['All', 'Not Ready', 'In Progress', 'Hold', 'Completed'].includes(activeFilter) ? activeFilter : 'All'}
                  onChange={(e) => {
                    setActiveFilter(e.target.value);
                    setCurrentPageNum(1);
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Not Ready">Not Ready</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full sm:w-auto flex-1 min-w-[140px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Production Stage</span>
              <div className="relative group">
                <select
                  className="relative z-10 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 pr-10 text-[11px] font-bold outline-none transition cursor-pointer hover:border-[var(--accent)] h-11"
                  value={Object.keys(PRODUCTION_STAGES).includes(activeFilter) ? activeFilter : 'All'}
                  onChange={(e) => {
                    setActiveFilter(e.target.value);
                    setCurrentPageNum(1);
                  }}
                >
                  <option value="All">All Stages</option>
                  {Object.keys(PRODUCTION_STAGES).map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--border)]/50">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Delivery Tracker</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex h-11 items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth w-full sm:w-auto">
                {['All', 'Today', 'Tomorrow', 'Week', 'Custom'].map((df) => (
                  <button
                    key={df}
                    onClick={() => setDateFilter(df)}
                    className={`h-9 px-4 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center justify-center shrink-0 ${dateFilter === df ? 'bg-[var(--accent)] text-white shadow-md' : 'bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    {df}
                  </button>
                ))}
              </div>
              {dateFilter === 'Custom' && (
                <div className="w-full sm:w-auto animate-in fade-in zoom-in-95 duration-200">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full sm:w-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-[11px] font-bold outline-none focus:border-[var(--accent)] h-11 sm:h-9 shadow-sm transition-colors"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <section id="orders-table" className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text)]">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
            {dateFilter !== 'All' && <span className="text-[var(--muted)] ml-1">for {dateFilter === 'Custom' ? customDate : dateFilter}</span>}
          </p>
          <p className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
            {activeFilter !== 'All' ? activeFilter : 'All Statuses'}
          </p>
        </div>
        <div 
          className={`erp-table-container overflow-x-auto min-h-[400px] hidden lg:block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          ref={tableContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <table className="erp-table">
            <thead>
              <tr>
                {[
                  { key: 'id', label: 'Order ID' },
                  { key: 'clientName', label: 'Client' },
                  { key: 'priority', label: 'Priority' }
                ].map(header => (
                  <th
                    key={header.key}
                    className={`cursor-pointer transition hover:text-[var(--accent)] group ${header.key === 'clientName' ? 'md:sticky md:left-0 md:z-20 bg-[var(--surface-strong)] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                    onClick={() => {
                      setSortConfig(prev => ({
                        key: header.key,
                        direction: prev.key === header.key && prev.direction === 'desc' ? 'asc' : 'desc'
                      }))
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {header.label}
                      <span className={`transition-opacity ${sortConfig.key === header.key ? 'opacity-100' : 'opacity-20 group-hover:opacity-100'}`}>
                        {sortConfig.key === header.key && sortConfig.direction === 'asc' ? 'â†‘' : 'â†“'}
                      </span>
                    </div>
                  </th>
                ))}
                <th>Photo</th>
                <th>Details</th>
                <th
                  className="cursor-pointer transition hover:text-[var(--accent)] group"
                  onClick={() => {
                    setSortConfig(prev => ({
                      key: 'deliveryDate',
                      direction: prev.key === 'deliveryDate' && prev.direction === 'desc' ? 'asc' : 'desc'
                    }))
                  }}
                >
                  <div className="flex items-center gap-1">
                    Dates
                    <span className={`transition-opacity ${sortConfig.key === 'deliveryDate' ? 'opacity-100' : 'opacity-20 group-hover:opacity-100'}`}>
                      {sortConfig.key === 'deliveryDate' && sortConfig.direction === 'asc' ? 'â†‘' : 'â†“'}
                    </span>
                  </div>
                </th>
                <th className="min-w-[140px]">Progress & Work</th>
                <th className="min-w-[130px]">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isDataLoading ? (
                // Skeleton Table Rows
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton h-5 w-16 rounded" /></td>
                    <td><div className="skeleton h-5 w-32 rounded" /></td>
                    <td><div className="skeleton h-10 w-10 rounded-lg" /></td>
                    <td>
                      <div className="skeleton h-5 w-32 rounded mb-1" />
                      <div className="skeleton h-4 w-24 rounded" />
                    </td>
                    <td>
                      <div className="skeleton h-4 w-24 rounded mb-1" />
                      <div className="skeleton h-4 w-24 rounded" />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="skeleton h-9 w-28 rounded-xl" />
                        <div className="skeleton h-4 w-6 rounded" />
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <div className="skeleton h-8 w-8 rounded-lg" />
                        <div className="skeleton h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedOrders.map((order, index) => {
                const progress = getProgress(order)
                return (
                  <tr
                    key={order.id}
                    ref={el => rowRefs.current[order.id] = el}
                    className={`group transition-all duration-1000 ${highlightOrderId === order.id ? 'ring-2 ring-[var(--accent)] ring-inset' : ''} ${order.status === 'Hold' ? '[&_td]:!text-orange-500 [&_span]:!text-orange-500 [&_p]:!text-orange-500 [&_button]:!text-orange-500 [&_select]:!text-orange-500 [&_select]:!border-orange-500/30' : ''}`}
                    style={{
                      background: progress > 0 ? `linear-gradient(to right, ${order.status === 'Completed' || order.status === 'Sold' ? 'rgba(34, 197, 94, 0.04)' :
                        order.status === 'Hold' ? 'rgba(249, 115, 22, 0.04)' :
                          'color-mix(in srgb, var(--accent) 4%, transparent)'
                        } ${progress}%, transparent ${progress}%)` : undefined
                    }}
                  >
                    <td className="font-medium text-[var(--text)]">#{order.id}</td>
                    <td 
                      className="md:sticky md:left-0 md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      style={{
                        background: progress > 0 
                          ? `linear-gradient(to right, ${
                              order.status === 'Completed' || order.status === 'Sold' ? 'rgba(34, 197, 94, 0.04)' :
                              order.status === 'Hold' ? 'rgba(249, 115, 22, 0.04)' :
                              'color-mix(in srgb, var(--accent) 4%, transparent)'
                            }, ${
                              order.status === 'Completed' || order.status === 'Sold' ? 'rgba(34, 197, 94, 0.04)' :
                              order.status === 'Hold' ? 'rgba(249, 115, 22, 0.04)' :
                              'color-mix(in srgb, var(--accent) 4%, transparent)'
                            }), var(--surface-strong)`
                          : 'var(--surface-strong)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const clientObj = (clients || []).find(c => c.name?.toLowerCase().trim() === order.clientName?.toLowerCase().trim());
                          if (clientObj && setSelectedClient && setClientDetailMode && setCurrentPage) {
                            setSelectedClient(clientObj);
                            setClientDetailMode('view');
                            setCurrentPage('client-detail');
                          } else if (!clientObj && showGlobalToast) {
                            showGlobalToast('Not Found', 'Client details could not be found.');
                          }
                        }}
                        className="font-semibold text-[var(--accent)] hover:underline text-left break-words"
                      >
                        {order.clientName}
                      </button>
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        order.priority === 'High' ? 'bg-red-100 text-red-700' :
                        order.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.priority || 'Normal'}
                      </span>
                    </td>
                    <td>
                      {order.photo ? (
                        <img
                          src={order.photo}
                          alt="thumb"
                          className="h-10 w-10 rounded-lg object-cover cursor-pointer border border-[var(--border)] transition hover:opacity-80"
                          onClick={() => setImagePopup(order.photo)}
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--soft)] text-[var(--muted)]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                      )}
                    </td>
                    <td>
                      <p className="text-[var(--text)] font-medium">{order.product}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex gap-2 items-center text-xs">
                          <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[var(--muted)]">{order.orderType}</span>
                          <span className="font-semibold text-[var(--accent)]">â‚¹{order.price}</span>
                        </div>
                        {order.advance > 0 && (
                          <div className="text-[10px] font-semibold text-green-600">
                            Adv: â‚¹{order.advance} â€¢ Bal: â‚¹{(parseFloat(order.price || 0) - parseFloat(order.advance || 0)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-[var(--muted)]">Order: <span className="font-medium text-[var(--text)]">{formatDateDDMMYY(order.orderDate)}</span></span>
                        <span className="text-[var(--muted)]">Delivery: <span className="font-medium text-[var(--text)]">{formatDateDDMMYY(order.deliveryDate)}</span></span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                           <span className={order.risk === 'Delayed' ? 'text-red-500' : order.risk === 'At Risk' ? 'text-orange-500' : 'text-emerald-500'}>{order.risk || 'On Track'}</span>
                           <span className="text-[var(--text)]">{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                           <div className={`h-full transition-all ${order.risk === 'Delayed' ? 'bg-red-500' : order.risk === 'At Risk' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                          <div className="relative mt-1 stage-popover-container">
                            {order.status === 'Completed' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sessionStorage.setItem('erp_sales_init', JSON.stringify(order));
                                  sessionStorage.setItem('erp_sales_back', 'view-orders');
                                  if (setCurrentPage) setCurrentPage('create-sales');
                                }}
                                className="w-full flex items-center justify-center gap-1 rounded-lg border border-emerald-500 bg-emerald-500 text-white px-2 py-1 text-[10px] font-bold shadow-sm transition hover:brightness-95"
                              >
                                <CircleDollarSign size={12} /> Pay Now
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (order.status === 'Sold') return;
                                  setOpenStagePopoverId(openStagePopoverId === order.id ? null : order.id);
                                }}
                                className={`w-full flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1 text-[10px] font-bold outline-none transition ${order.status === 'Sold' ? 'cursor-not-allowed opacity-70 text-emerald-600 border-emerald-500/30' : 'cursor-pointer hover:border-[var(--accent)] text-[var(--accent)]'}`}
                              >
                                <span className="truncate pr-2">
                                  {order.status === 'Sold' ? 'Completed' : 
                                    (!order.productionTasks || order.productionTasks.every(t => t.status === 'Pending')) ? 'Not Started' :
                                    (order.productionTasks.filter(t => t.status === 'In Progress').length > 0 
                                      ? order.productionTasks.filter(t => t.status === 'In Progress').map(t => t.stage).join(', ') 
                                      : (order.currentStage || 'Completed'))}
                                </span>
                                <ChevronDown size={12} className="flex-shrink-0" />
                              </button>
                            )}
                            
                            {openStagePopoverId === order.id && order.status !== 'Completed' && order.status !== 'Sold' && (
                              <div className={`hidden sm:flex absolute ${index >= paginatedOrders.length - 2 && paginatedOrders.length > 3 ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-64 bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl shadow-xl z-[100] p-2 text-xs flex-col gap-1 backdrop-blur-xl`}>
                                {(order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default']).map(stage => {
                                  const task = (order.productionTasks || []).find(t => t.stage === stage) || { status: 'Pending' };
                                  let disableCompletedButton = false;
                                  if (stage === 'Finished') {
                                    const workflow = order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default'];
                                    disableCompletedButton = workflow.some(s => {
                                      if (s === 'Finished') return false;
                                      const t = (order.productionTasks || []).find(pt => pt.stage === s);
                                      if (s === 'Handwork') {
                                        if (!t || t.status === 'Pending') return false;
                                      }
                                      return !t || t.status !== 'Completed';
                                    });
                                  }
                                  return (
                                    <div key={stage} className="flex items-center justify-between p-1.5 hover:bg-[var(--soft)] rounded-lg transition">
                                      <div className="flex flex-col overflow-hidden pr-2">
                                        <span className="font-medium text-[var(--text)] truncate max-w-[110px]" title={stage}>{stage}</span>
                                        {task.startedAt && (
                                          <span className="text-[9px] text-[var(--muted)] leading-tight mt-0.5">Start: {new Date(task.startedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                        {task.completedAt && (
                                          <span className="text-[9px] text-emerald-600 leading-tight">Done: {new Date(task.completedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                      </div>
                                      <div className="flex bg-[var(--surface-strong)] rounded-md border border-[var(--border)] overflow-hidden flex-shrink-0">
                                          {stage !== 'Finished' && (
                                            <>
                                              <button 
                                                title="Hold"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'Hold'); }}
                                                className={`p-1.5 transition ${task.status === 'Hold' ? 'bg-red-500/20 text-red-500' : 'text-[var(--muted)] hover:text-red-500'}`}
                                              >
                                                <Pause size={12} />
                                              </button>
                                              <button 
                                                title="In Progress"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'In Progress'); }}
                                                className={`p-1.5 transition ${task.status === 'In Progress' ? 'bg-orange-500/20 text-orange-500' : 'text-[var(--muted)] hover:text-orange-500'}`}
                                              >
                                                <Play size={12} />
                                              </button>
                                            </>
                                          )}
                                          <button 
                                            title={disableCompletedButton ? "Complete all other tasks first" : "Completed"}
                                            onClick={(e) => { 
                                              if (disableCompletedButton) return;
                                              e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'Completed'); 
                                            }}
                                            className={`p-1.5 transition ${task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : disableCompletedButton ? 'text-[var(--muted)] opacity-50 cursor-not-allowed' : 'text-[var(--muted)] hover:text-emerald-500'}`}
                                          >
                                            <CheckCircle2 size={12} />
                                          </button>
                                        </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="relative group min-w-[130px]">
                          <select
                            className={`relative z-10 w-full appearance-none rounded-xl border bg-[var(--surface-strong)] px-3 py-2 pr-8 text-[11px] font-bold outline-none transition cursor-pointer active:scale-95 ${order.status === 'Completed' || order.status === 'Sold' ? 'text-green-600 border-green-500/30' : order.status === 'Hold' ? 'text-orange-500 border-orange-500/30' : 'text-[var(--text)] border-[var(--border)]'}`}
                            value={order.status || 'Not Ready'}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={order.status === 'Sold'}
                          >
                            <option value="Not Ready">Not Ready</option>
                            <option value="In Progress" disabled>In Progress</option>
                            <option value="Hold">Hold</option>
                            <option value="Completed" disabled>Completed</option>
                            <option value="Sold" disabled>Sold</option>
                          </select>
                          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      {order.startDate && order.status !== 'Pending' && (
                        <p className="text-[var(--muted)] mt-1.5 !text-[10px]">Started: {formatDateDDMMYY(order.startDate)}</p>
                      )}
                      {(order.completedDate || order.closedDate) && (order.status === 'Completed' || order.status === 'Sold') && (
                        <p className="text-[var(--muted)] mt-0.5 !text-[10px]">Completed: {formatDateDDMMYY(order.completedDate || order.closedDate)}</p>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2 transition-opacity">
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" title="View Order" onClick={() => setViewOrder(order)}>
                          <Eye size={16} />
                        </button>
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" title="Edit Order" onClick={() => setEditOrder(order)}>
                          <Pencil size={16} />
                        </button>
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" title="Delete Order" onClick={() => setOrderToDelete(order)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginatedOrders.length === 0 && !isDataLoading && (
                <tr>
                  <td colSpan="7" className="text-center text-[var(--muted)]">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Accordion View */}
        <div className="block lg:hidden mt-4">
          {isDataLoading ? (
            // Skeleton for mobile
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-[var(--surface-strong)] border border-[var(--border)] rounded-[16px] p-4 flex items-center justify-between animate-pulse">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-12 bg-[var(--border)] rounded"></div>
                      <div className="h-5 w-20 bg-[var(--border)] rounded-full"></div>
                    </div>
                    <div className="h-6 w-32 bg-[var(--border)] rounded mt-1"></div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 w-24 bg-[var(--border)] rounded-full opacity-50"></div>
                      <div className="h-3 w-6 bg-[var(--border)] rounded"></div>
                    </div>
                  </div>
                  <div className="h-6 w-6 bg-[var(--border)] rounded-full"></div>
                </div>
              ))}
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">No orders found.</div>
          ) : (
            <Virtuoso
              useWindowScroll
              overscan={200}
              data={sortedOrders}
              itemContent={(index, order) => {
                const progress = getProgress(order);
                const isExpanded = expandedOrderId === order.id;
                return (
                  <div className="pb-4">
                    <div 
                      key={order.id} 
                      className={`rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] transition-all duration-300 ${highlightOrderId === order.id ? 'ring-2 ring-[var(--accent)] ring-inset' : ''} ${order.status === 'Hold' ? '[&_span]:!text-orange-500 [&_p]:!text-orange-500 [&_button]:!text-orange-500' : ''}`}
                style={{
                  background: progress > 0 ? `linear-gradient(to right, ${order.status === 'Completed' || order.status === 'Sold' ? 'rgba(34, 197, 94, 0.04)' :
                    order.status === 'Hold' ? 'rgba(249, 115, 22, 0.04)' :
                      'color-mix(in srgb, var(--accent) 4%, transparent)'
                    } ${progress}%, transparent ${progress}%)` : undefined
                }}
              >
                {/* Accordion Header (Always Visible) */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)]">#{order.id}</span>
                      <div className="relative stage-popover-container">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.status === 'Sold' || order.status === 'Completed') return;
                            setOpenStagePopoverId(openStagePopoverId === order.id ? null : order.id);
                          }}
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] font-semibold transition ${order.status === 'Sold' || order.status === 'Completed' ? 'bg-[var(--surface)] text-[var(--muted)] cursor-default' : 'bg-[var(--surface-strong)] text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer'}`}
                        >
                          <span className="max-w-[100px] truncate">
                            {order.status === 'Sold' ? 'Completed' : 
                              (!order.productionTasks || order.productionTasks.every(t => t.status === 'Pending')) ? 'Not Started' :
                              (order.productionTasks.filter(t => t.status === 'In Progress').length > 0 
                                ? order.productionTasks.filter(t => t.status === 'In Progress').map(t => t.stage).join(', ') 
                                : (order.currentStage || 'Completed'))}
                          </span>
                          {order.status !== 'Sold' && order.status !== 'Completed' && (
                            <ChevronDown size={10} />
                          )}
                        </button>
                        {openStagePopoverId === order.id && order.status !== 'Completed' && order.status !== 'Sold' && (
                          <div className="hidden sm:flex absolute top-full left-0 mt-1 w-[240px] max-h-[250px] overflow-y-auto bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl shadow-xl z-[100] p-2 text-xs flex-col gap-1 backdrop-blur-xl custom-scrollbar">
                            {(order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default']).map(stage => {
                              const task = (order.productionTasks || []).find(t => t.stage === stage) || { status: 'Pending' };
                              let disableCompletedButton = false;
                              if (stage === 'Finished') {
                                const workflow = order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default'];
                                disableCompletedButton = workflow.some(s => {
                                  if (s === 'Finished') return false;
                                  const t = (order.productionTasks || []).find(pt => pt.stage === s);
                                  if (s === 'Handwork') {
                                    if (!t || t.status === 'Pending') return false;
                                  }
                                  return !t || t.status !== 'Completed';
                                });
                              }
                              return (
                                <div key={stage} className="flex items-center justify-between p-1.5 hover:bg-[var(--soft)] rounded-lg transition" onClick={e => e.stopPropagation()}>
                                  <div className="flex flex-col overflow-hidden pr-2">
                                    <span className="font-medium text-[var(--text)] truncate max-w-[110px]">{stage}</span>
                                  </div>
                                  <div className="flex bg-[var(--surface-strong)] rounded-md border border-[var(--border)] overflow-hidden flex-shrink-0">
                                      {stage !== 'Finished' && (
                                        <>
                                          <button 
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'Hold'); }}
                                            className={`p-1.5 transition ${task.status === 'Hold' ? 'bg-red-500/20 text-red-500' : 'text-[var(--muted)] hover:text-red-500'}`}
                                          >
                                            <Pause size={12} />
                                          </button>
                                          <button 
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'In Progress'); }}
                                            className={`p-1.5 transition ${task.status === 'In Progress' ? 'bg-orange-500/20 text-orange-500' : 'text-[var(--muted)] hover:text-orange-500'}`}
                                          >
                                            <Play size={12} />
                                          </button>
                                        </>
                                      )}
                                      <button 
                                        disabled={disableCompletedButton}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(!disableCompletedButton) handleTaskStatusChange(order.id, stage, 'Completed'); }}
                                        className={`p-1.5 transition ${task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : 'text-[var(--muted)] hover:text-emerald-500'} ${disableCompletedButton ? 'opacity-30 cursor-not-allowed' : ''}`}
                                      >
                                        <CheckCircle2 size={12} />
                                      </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const clientObj = (clients || []).find(c => c.name?.toLowerCase().trim() === order.clientName?.toLowerCase().trim());
                        if (clientObj && setSelectedClient && setClientDetailMode && setCurrentPage) {
                          setSelectedClient(clientObj);
                          setClientDetailMode('view');
                          setCurrentPage('client-detail');
                        } else if (!clientObj && showGlobalToast) {
                          showGlobalToast('Not Found', 'Client details could not be found.');
                        }
                      }}
                      className="font-semibold text-lg text-[var(--accent)] hover:underline text-left break-words"
                    >
                      {order.clientName}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 w-24 bg-[var(--border)] rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${order.risk === 'Delayed' ? 'bg-red-500' : order.risk === 'At Risk' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text)]">{progress}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ChevronDown size={20} className={`text-[var(--muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Accordion Body (Visible when expanded) */}
                {isExpanded && (
                  <div className="px-3 pb-4 border-t border-[var(--border)]/30 pt-3 flex flex-col gap-3 bg-[var(--soft)]/20">
                    
                    {/* Top Row: Dates & Status */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2 bg-[var(--surface-strong)] rounded-xl p-3 border border-[var(--border)]/40 shadow-sm">
                        <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] font-bold flex items-center gap-1"><Calendar size={10} /> Timeline</span>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <div className="flex justify-between items-center"><span className="text-[var(--muted)]">Order:</span> <span className="font-semibold text-[var(--text)]">{formatDateDDMMYY(order.orderDate)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-[var(--muted)]">Delivery:</span> <span className="font-semibold text-[var(--text)]">{formatDateDDMMYY(order.deliveryDate)}</span></div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 bg-[var(--surface-strong)] rounded-xl p-3 border border-[var(--border)]/40 shadow-sm">
                        <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] font-bold flex items-center gap-1"><AlertCircle size={10} /> Status</span>
                        <div className="flex flex-col gap-1.5 items-end justify-center h-full">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${order.priority === 'High' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : order.priority === 'Medium' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'}`}>
                            {order.priority || 'Normal'}
                          </span>
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${order.risk === 'Delayed' ? 'text-red-500' : order.risk === 'At Risk' ? 'text-orange-500' : 'text-emerald-500'}`}>
                             {order.risk === 'Delayed' ? <XCircle size={10} /> : order.risk === 'At Risk' ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                             {order.risk || 'On Track'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Product Details */}
                    <div className="flex items-start gap-3 bg-[var(--surface-strong)] rounded-xl p-3 border border-[var(--border)]/40 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)]"></div>
                      {order.image ? (
                        <div 
                          className="relative h-20 w-20 rounded-xl overflow-hidden border border-[var(--border)]/50 cursor-pointer shadow-sm group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePopup(order.image);
                          }}
                        >
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white z-10">
                            <ZoomIn size={16} />
                          </div>
                          <div className="absolute inset-0 animate-pulse bg-[var(--border)] opacity-30 -z-10"></div>
                          <img 
                            src={order.image} 
                            alt="Order" 
                            className="h-full w-full object-cover transition-opacity duration-300 opacity-0"
                            onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-xl bg-[var(--surface)] flex flex-col items-center justify-center text-[var(--muted)] border border-[var(--border)]/50 shadow-sm">
                          <Eye size={18} className="opacity-50" />
                          <span className="text-[9px] mt-1.5 font-medium uppercase tracking-wider">No Image</span>
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text)] truncate">{order.product}</p>
                        <p className="text-[11px] text-[var(--muted)] truncate font-medium">{order.fabric}</p>
                        <div className="mt-1 flex flex-col gap-1 bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]/30">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[var(--muted)] font-medium">Total Price</span>
                            <span className="font-bold text-[var(--accent)] text-sm">â‚¹{order.price}</span>
                          </div>
                          {order.advance > 0 && (
                            <div className="flex justify-between items-center border-t border-[var(--border)]/50 pt-1 mt-0.5">
                              <span className="text-[9px] text-[var(--muted)]">Adv: â‚¹{order.advance}</span>
                              <span className="text-[10px] font-bold text-green-600">Bal: â‚¹{(parseFloat(order.price || 0) - parseFloat(order.advance || 0)).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Actions & Status */}
                    <div className="flex flex-col gap-3 bg-[var(--surface-strong)] rounded-xl p-3 border border-[var(--border)]/40 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[var(--text)]">Production Status</span>
                        <div className="relative w-36">
                          <select
                            className={`relative z-10 w-full appearance-none rounded-lg border bg-[var(--surface)] px-2.5 py-1.5 pr-6 text-[11px] font-bold outline-none transition cursor-pointer active:scale-95 shadow-sm ${order.status === 'Completed' || order.status === 'Sold' ? 'text-emerald-600 border-emerald-500/30' : order.status === 'Hold' ? 'text-orange-500 border-orange-500/30' : 'text-[var(--text)] border-[var(--border)]'}`}
                            value={order.status || 'Not Ready'}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={order.status === 'Sold'}
                          >
                            <option value="Not Ready">Not Ready</option>
                            <option value="In Progress" disabled>In Progress</option>
                            <option value="Hold">Hold</option>
                            <option value="Completed" disabled>Completed</option>
                            <option value="Sold" disabled>Sold</option>
                          </select>
                          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      
                      {((order.startDate && order.status !== 'Pending') || ((order.completedDate || order.closedDate) && (order.status === 'Completed' || order.status === 'Sold'))) && (
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)] border-t border-[var(--border)]/50 pt-2 mt-1">
                          {order.startDate && order.status !== 'Pending' ? (
                            <span className="flex items-center gap-1"><Clock size={10} /> Started: {formatDateDDMMYY(order.startDate)}</span>
                          ) : <span />}
                          {(order.completedDate || order.closedDate) && (order.status === 'Completed' || order.status === 'Sold') && (
                            <span className="flex items-center gap-1 text-emerald-500/80"><CheckCircle2 size={10} /> Done: {formatDateDDMMYY(order.completedDate || order.closedDate)}</span>
                          )}
                        </div>
                      )}

                      {/* Pay Now Button (if completed) */}
                      {order.status === 'Completed' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sessionStorage.setItem('erp_sales_init', JSON.stringify(order));
                            sessionStorage.setItem('erp_sales_back', 'view-orders');
                            if (setCurrentPage) setCurrentPage('create-sales');
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-white px-3 py-2 text-[11px] font-bold shadow-md transition hover:bg-emerald-600 active:scale-95"
                        >
                          <CircleDollarSign size={14} /> Proceed to Billing
                        </button>
                      )}

                      <div className="flex gap-2 mt-1">
                        <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]/50 shadow-sm flex-1">
                           <button title="View Details" className="flex-1 flex justify-center py-1.5 rounded-md bg-transparent text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition" onClick={() => setViewOrder(order)}>
                             <Eye size={14} />
                           </button>
                           <div className="w-px h-4 bg-[var(--border)]/50"></div>
                           <button title="Edit Order" className="flex-1 flex justify-center py-1.5 rounded-md bg-transparent text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition" onClick={() => setEditOrder(order)}>
                             <Pencil size={14} />
                           </button>
                           <div className="w-px h-4 bg-[var(--border)]/50"></div>
                           <button title="Delete Order" className="flex-1 flex justify-center py-1.5 rounded-md bg-transparent text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 transition" onClick={() => setOrderToDelete(order)}>
                             <Trash2 size={14} />
                           </button>
                        </div>

                        <button
                          title="Send WhatsApp Update"
                          onClick={() => {
                            setWaData({
                              phone: clients.find(c => c.name?.toLowerCase() === order.clientName?.toLowerCase())?.phone || '',
                              name: order.clientName || '',
                              message: `Hi ${order.clientName},\n\nYour order #${order.id} for ${order.product} is currently ${order.status}.\nProgress: ${progress}%\nEstimated Delivery: ${formatDateDDMMYY(order.deliveryDate)}\n\nThank you!`,
                              orderId: order.id
                            })
                            setShowWaPopup(true)
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] px-4 py-2 text-[11px] font-bold shadow-sm transition hover:bg-[#25D366]/20 active:scale-95"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>


        {totalPages > 1 && (
          <div className="mt-4 hidden lg:flex items-center justify-between border-t border-[var(--border)] pt-4">
            <span className="text-sm text-[var(--muted)]">Showing {(currentPageNum - 1) * itemsPerPage + 1} to {Math.min(currentPageNum * itemsPerPage, filteredOrders.length)} of {filteredOrders.length}</span>
            <div className="flex gap-2">
              <button
                disabled={currentPageNum === 1}
                onClick={() => setCurrentPageNum(prev => prev - 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-50 text-[var(--text)]"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={currentPageNum === totalPages}
                onClick={() => setCurrentPageNum(prev => prev + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-50 text-[var(--text)]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Global Mobile Bottom Sheet for Stage Updates */}
      {openStagePopoverId && (() => {
        const order = orders.find(o => o.id === openStagePopoverId);
        if (!order || order.status === 'Completed' || order.status === 'Sold') return null;
        return (
          <div className="sm:hidden stage-popover-container">
            <div className="fixed inset-0 z-[1999] bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setOpenStagePopoverId(null); }} />
            <div className="fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto bg-[var(--surface-strong)] border-t border-[var(--border)] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-[2000] p-5 text-xs flex flex-col gap-2 backdrop-blur-xl custom-scrollbar animate-slide-up pb-safe">
              <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-2" />
              <div className="flex flex-col mb-2 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[15px] text-[var(--text)]">Update Stage</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setOpenStagePopoverId(null); }} className="p-1.5 rounded-full bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)] transition"><X size={18}/></button>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5 truncate pr-4 font-medium">
                  {order.clientName} <span className="opacity-50 mx-1">â€¢</span> #{order.id}
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {(order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default']).map(stage => {
                  const task = (order.productionTasks || []).find(t => t.stage === stage) || { status: 'Pending' };
                  let disableCompletedButton = false;
                  if (stage === 'Finished') {
                    const workflow = order.workflow || DEFAULT_WORKFLOWS[order.product] || DEFAULT_WORKFLOWS['Default'];
                    disableCompletedButton = workflow.some(s => {
                      if (s === 'Finished') return false;
                      const t = (order.productionTasks || []).find(pt => pt.stage === s);
                      if (s === 'Handwork') {
                        if (!t || t.status === 'Pending') return false;
                      }
                      return !t || t.status !== 'Completed';
                    });
                  }
                  return (
                    <div key={stage} className="flex items-center justify-between p-2 hover:bg-[var(--soft)] rounded-xl transition bg-[var(--surface)] border border-[var(--border)]/50" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col overflow-hidden pr-2">
                        <span className="font-bold text-sm text-[var(--text)] truncate">{stage}</span>
                        {task.startedAt && (
                          <span className="text-[10px] text-[var(--muted)] leading-tight mt-1">Start: {new Date(task.startedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {task.completedAt && (
                          <span className="text-[10px] text-emerald-600 font-medium leading-tight mt-0.5">Done: {new Date(task.completedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      <div className="flex bg-[var(--surface-strong)] rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0 shadow-sm">
                          {stage !== 'Finished' && (
                            <>
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'Hold'); }}
                                className={`p-2.5 transition ${task.status === 'Hold' ? 'bg-red-500/20 text-red-500' : 'text-[var(--muted)] hover:text-red-500 hover:bg-red-50'}`}
                              >
                                <Pause size={16} />
                              </button>
                              <div className="w-px bg-[var(--border)]" />
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTaskStatusChange(order.id, stage, 'In Progress'); }}
                                className={`p-2.5 transition ${task.status === 'In Progress' ? 'bg-orange-500/20 text-orange-500' : 'text-[var(--muted)] hover:text-orange-500 hover:bg-orange-50'}`}
                              >
                                <Play size={16} />
                              </button>
                              <div className="w-px bg-[var(--border)]" />
                            </>
                          )}
                          <button 
                            disabled={disableCompletedButton}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(!disableCompletedButton) handleTaskStatusChange(order.id, stage, 'Completed'); }}
                            className={`p-2.5 transition ${task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : 'text-[var(--muted)] hover:text-emerald-500 hover:bg-emerald-50'} ${disableCompletedButton ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {imagePopup && (
        <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/80 px-4 backdrop-blur-sm" onClick={() => setImagePopup(null)}>
          <div className="relative">
            <button className="absolute -top-4 -right-4 grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--text)] shadow-lg hover:bg-[var(--soft)]" onClick={() => setImagePopup(null)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <img src={imagePopup} alt="Reference" className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl border-4 border-white" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewOrdersPage;
