import React, { useState, useEffect, useRef } from 'react'
import { Package, Search, TrendingUp, UsersRound, Trash2, Download, ShoppingCart, CheckCircle, Plus, Eye, Info, Calendar } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { generateReceiptHtmlString } from '../../utils/pdfHelper'
import supabase from '../../supabase'
import { encryptId } from '../../utils/security'
import { orders } from '../../utils/constants'
import CustomDatePicker from '../../components/CustomDatePicker'

function CreateSalesPage({ themeStyle, setCurrentPage, showGlobalToast, inventory, setInventory, clients, setClients, orders, setOrders, sales, setSales, saveSale, saveOrder }) {
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [stockWarning, setStockWarning] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [selectionMode, setSelectionMode] = useState('inventory');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [splitPayments, setSplitPayments] = useState({ Cash: 0, UPI: 0, Card: 0, 'Bank Transfer': 0, Cheque: 0 });
  const [showReceipt, setShowReceipt] = useState(null);
  const [cartAlert, setCartAlert] = useState(null); // { title: '', message: '', type: 'warning'|'error' }
  const [isSendingPdf, setIsSendingPdf] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [imagePopup, setImagePopup] = useState(null);
  const [pendingClientSwitch, setPendingClientSwitch] = useState(null);
  const tableContainerRef = useRef(null);
  const paymentScrollRef = useRef(null);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;

      // If table is horizontally scrollable and user is scrolling vertically
      if (hasHorizontalScroll && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation(); // Ensure parent containers don't catch it
        container.scrollLeft += e.deltaY;
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [cart]); // Re-bind if cart changes just in case, though empty array is mostly fine since ref persists

  useEffect(() => {
    const container = paymentScrollRef.current;
    if (!container) return;
    
    // For drag to scroll
    let isDown = false;
    let startX;
    let scrollLeft;

    const handleMouseDown = (e) => {
      isDown = true;
      container.classList.add('cursor-grabbing');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    };
    const handleMouseLeave = () => {
      isDown = false;
      container.classList.remove('cursor-grabbing');
    };
    const handleMouseUp = () => {
      isDown = false;
      container.classList.remove('cursor-grabbing');
    };
    const handleMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 2;
      container.scrollLeft = scrollLeft - walk;
    };

    // For wheel to scroll
    const handleWheel = (e) => {
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      if (hasHorizontalScroll && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (cart.length === 0) {
      setSelectedClient(null);
      setClientSearch('');
    }
  }, [cart.length]);

  useEffect(() => {
    const initDataStr = sessionStorage.getItem('erp_sales_init');
    if (initDataStr) {
      try {
        const item = JSON.parse(initDataStr);

        // Wait for clients to load before consuming the init data
        if (!clients || clients.length === 0) return;

        const price = parsePrice(item.price);
        const advance = parseFloat(item.advance) || 0;
        const parsedQty = item.size ? parseFloat(item.size) || 1 : 1;
        const parsedUnit = item.size ? item.size.replace(/[0-9.]/g, '').trim() || 'nos' : 'nos';

        setCart([{
          id: `ORD-${item.id}`,
          productId: `ORD-${item.id}`,
          orderId: item.id,
          productName: `${item.product} (Order #${item.id})`,
          qty: parsedQty,
          unit: parsedUnit,
          rate: price,
          discount: 0,
          advancePaid: advance,
          finalPrice: price,
          type: 'order',
          clientName: item.clientName
        }]);
        
        setClientSearch(item.clientName);
        const matchedClient = clients.find(c => c.name?.toLowerCase().trim() === item.clientName?.toLowerCase().trim());
        if (matchedClient) setSelectedClient(matchedClient);
        setSelectionMode('orders');
        sessionStorage.removeItem('erp_sales_init');
      } catch (e) {
        console.error(e);
        sessionStorage.removeItem('erp_sales_init');
      }
    }
  }, [clients]);


  const parsePrice = (priceStr) => {
    if (typeof priceStr !== 'string') return parseFloat(priceStr) || 0;
    return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
  };

  const filteredProducts = (inventory || []).filter(p =>
  ((p?.productName?.toLowerCase() || '').includes(productSearch.toLowerCase()) ||
    (p?.productId?.toLowerCase() || '').includes(productSearch.toLowerCase()))
  ).map(p => {
    // Subtract whatever qty is already in the cart so the remaining stock is shown
    const cartItem = cart.find(ci => ci.id === p.id && ci.type === 'inventory');
    const remainingQty = cartItem ? p.quantity - cartItem.qty : p.quantity;
    return { ...p, quantity: remainingQty };
  }).filter(p => p.quantity > 0); // hide if nothing left

  const readyOrders = (orders || []).filter(o =>
    o.status === 'Completed' &&
    !cart.some(ci => ci.orderId === o.id && ci.type === 'order') &&
    ((o.clientName?.toLowerCase() || '').includes(productSearch.toLowerCase()) ||
      (o.id?.toString() || '').includes(productSearch))
  );

  const filteredClients = (clients || []).filter(c =>
    (c?.name?.toLowerCase() || '').includes(clientSearch.toLowerCase()) ||
    (c?.phone || '').includes(clientSearch)
  );

  const handleAddGuest = () => {
    if (!clientSearch) return;
    const isPhone = /^[0-9]+$/.test(clientSearch);
    const newClient = {
      id: Date.now(),
      name: isPhone ? `Guest (${clientSearch})` : clientSearch,
      mobile: isPhone ? clientSearch : '',
      address: '',
      measurements: [],
      createdAt: new Date().toISOString()
    };

    if (selectedClient && selectedClient.id !== newClient.id && cart.length > 0) {
      setPendingClientSwitch(newClient);
    } else {
      const updatedClients = [...clients, newClient];
      localStorage.setItem('clients', JSON.stringify(updatedClients));
      setClients(updatedClients);
      setSelectedClient(newClient);
      setClientSearch(newClient.name);
      setIsSearchingClient(false);
      if (showGlobalToast) showGlobalToast('Guest Added', `${newClient.name} linked to sale.`);
    }
  };
  const addToCart = (item, type) => {
    if (type === 'order') {
      const existing = cart.find(i => i.orderId === item.id);
      if (existing) {
        setCartAlert({
          title: 'Order Already in Cart',
          message: `Order #${item.id} for ${item.clientName} is already added to your current selection.`,
          type: 'warning'
        });
        return;
      }

      const price = parsePrice(item.price);
      const advance = parseFloat(item.advance) || 0;
      const parsedQty = item.size ? parseFloat(item.size) || 1 : 1;
      const parsedUnit = item.size ? item.size.replace(/[0-9.]/g, '').trim() || 'nos' : 'nos';

      setCart([...cart, {
        id: `ORD-${item.id}`,
        productId: `ORD-${item.id}`,
        orderId: item.id,
        productName: `${item.product} (Order #${item.id})`,
        qty: parsedQty,
        unit: parsedUnit,
        rate: price,
        discount: 0,
        advancePaid: advance,
        finalPrice: price,
        type: 'order',
        clientName: item.clientName
      }]);

      if (!selectedClient) {
        const client = clients.find(c => c.name === item.clientName);
        if (client) setSelectedClient(client);
      } else if (item.clientName !== selectedClient.name) {
        if (showGlobalToast) {
          showGlobalToast('Order Added', `Added order for ${item.clientName} to this sale.`);
        }
      }
    } else {
      const existing = cart.find(i => i.id === item.id);
      if (existing) {
        if (existing.qty + 1 > item.quantity) {
          setStockWarning({ name: item.name, stock: item.quantity });
          return;
        }
        setCart(cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        if (item.quantity < 1) {
          setStockWarning({ name: item.name, stock: 0 });
          return;
        }
        setCart([...cart, {
          ...item,
          qty: 1,
          rate: item.finalPrice,
          discount: item.discount || 0,
          type: 'inventory'
        }]);
      }
    }
  };

  const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));

  const updateQty = (id, newQty) => {
    const cartItem = cart.find(i => i.id === id);
    if (cartItem.type === 'order') return;
    const product = inventory.find(p => p.id === id);
    if (newQty > product.quantity) {
      setStockWarning({ name: product.name, stock: product.quantity });
      return;
    }
    setCart(cart.map(item => item.id === id ? { ...item, qty: Math.max(1, newQty) } : item));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalAdvance = 0;
    cart.forEach(item => {
      const itemTotal = (parseFloat(item.finalPrice) || 0) * item.qty;
      const discountAmount = parseFloat(item.discount) || 0;
      const advanceAmount = parseFloat(item.advancePaid) || 0;
      subtotal += itemTotal;
      totalDiscount += discountAmount;
      totalAdvance += advanceAmount;
    });
    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(totalDiscount.toFixed(2)),
      advance: Number(totalAdvance.toFixed(2)),
      total: Number(Math.max(0, subtotal - totalDiscount - totalAdvance).toFixed(2))
    };
  };

  const updateDiscount = (id, newDiscount) => {
    setCart(cart.map(item => item.id === id ? { ...item, discount: newDiscount === '' ? '' : (parseFloat(newDiscount) || 0) } : item));
  };

  const updateAdvancePaid = (id, newAdvance) => {
    setCart(cart.map(item => item.id === id ? { ...item, advancePaid: newAdvance === '' ? '' : (parseFloat(newAdvance) || 0) } : item));
  };

  const updatePrice = (id, newPrice) => {
    setCart(cart.map(item => item.id === id ? { ...item, finalPrice: newPrice === '' ? '' : (parseFloat(newPrice) || 0) } : item));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      setCartAlert({
        title: 'Empty Cart',
        message: 'Please add at least one inventory item or completed order to proceed with the sale.',
        type: 'error'
      });
      return;
    }

    const hasEmptyCustomItem = cart.some(item => item.type === 'custom' && !item.productName.trim());
    if (hasEmptyCustomItem) {
      if (showGlobalToast) showGlobalToast('Missing Description', 'Please enter a description for all custom items.');
      setCartAlert({
        title: 'Missing Description',
        message: 'One or more custom items are missing a description. Please enter a description before completing the sale.',
        type: 'error'
      });
      return;
    }

    const hasZeroPriceItem = cart.some(item => {
      const price = parseFloat(item.finalPrice);
      if (item.type === 'custom') return isNaN(price) || price < 0; // Allow 0 price for alterations
      return isNaN(price) || price <= 0;
    });

    if (hasZeroPriceItem) {
      if (showGlobalToast) {
        showGlobalToast('Price Required', 'Please enter the price for all items.');
      }
      setCartAlert({
        title: 'Price Required',
        message: 'One or more items in the cart have a price of 0. Please enter the price before completing the sale.',
        type: 'error'
      });
      return;
    }

    const balanceTotal = calculateTotals().total;

    if (paymentMode === 'Split') {
      const splitTotal = Object.values(splitPayments).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      if (Math.abs(splitTotal - balanceTotal) > 0.01) {
        if (showGlobalToast) showGlobalToast('Split Payment Mismatch', 'The split amounts must equal the balance total.');
        setCartAlert({
          title: 'Payment Mismatch',
          message: `The total of your split payments (â‚¹${splitTotal.toFixed(2)}) does not match the Balance (â‚¹${balanceTotal.toFixed(2)}). Please adjust the amounts.`,
          type: 'error'
        });
        return;
      }
    }

    // Await all inventory updates to prevent race conditions with App.jsx realtime sync
    const inventoryPromises = [];
    const updatedInventory = inventory.map(p => {
      const cartItem = cart.find(item => item.id === p.id && item.type === 'inventory');
      if (cartItem) {
        const updatedItem = { ...p, quantity: parseFloat(p.quantity || 0) - parseFloat(cartItem.qty || 0) };
        const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === "" ? undefined : v));
        inventoryPromises.push(
          supabase.from('erp_inventory').upsert([{ id: p.id.toString(), data: clean(updatedItem) }])
        );
        return updatedItem;
      }
      return p;
    });

    Promise.all(inventoryPromises).catch(err => console.error("Inventory sync failed:", err));

    const updatedOrders = orders.map(o => {
      const cartItem = cart.find(item => item.orderId === o.id);
      if (cartItem) return { ...o, status: 'Sold', soldDate: new Date().toISOString(), price: cartItem.finalPrice };
      return o;
    });

    setInventory(updatedInventory);
    // Persist updated inventory quantities to localStorage
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    setOrders(updatedOrders);

    // Sync sold orders to cloud
    updatedOrders.forEach(o => {
      const isSoldNow = cart.some(item => item.orderId === o.id);
      if (isSoldNow && saveOrder) {
        saveOrder(o);
      }
    });

    // 1. Gather all clients involved in the sale (from selectedClient and order items in cart)
    const involvedClients = [];
    if (selectedClient) {
      involvedClients.push(selectedClient);
    }
    cart.forEach(item => {
      if (item.type === 'order' && item.clientName) {
        const found = clients.find(c => c.name === item.clientName);
        if (found && !involvedClients.some(c => c.id === found.id)) {
          involvedClients.push(found);
        }
      }
    });

    // 2. Combine the names of unique clients
    const uniqueClientNames = [];
    involvedClients.forEach(c => {
      if (c.name && !uniqueClientNames.includes(c.name)) {
        uniqueClientNames.push(c.name);
      }
    });
    const combinedName = uniqueClientNames.length > 0 ? uniqueClientNames.join(', ') : (selectedClient ? selectedClient.name : 'Guest');

    // 3. Find phone numbers across all involved clients
    const clientsWithPhone = involvedClients.filter(c => c.mobile && c.mobile.trim() !== '');
    let targetPhone = '';

    if (selectedClient && selectedClient.mobile && selectedClient.mobile.trim() !== '') {
      targetPhone = selectedClient.mobile;
    } else if (clientsWithPhone.length > 0) {
      targetPhone = clientsWithPhone[0].mobile;
    }

    const newSale = {
      id: Date.now(),
      saleId: `SALE-${Math.floor(1000 + Math.random() * 9000)}`,
      client: {
        id: selectedClient ? selectedClient.id : 'multi',
        name: combinedName,
        phone: targetPhone
      },
      items: cart.map(item => {
        const itemPrice = parseFloat(item.finalPrice) || 0;
        const itemTotal = itemPrice * item.qty;
        const discountAmount = parseFloat(item.discount) || 0;
        const advanceAmount = parseFloat(item.advancePaid) || 0;
        const finalLineTotal = Math.max(0, itemTotal - discountAmount);

        return {
          id: item.productId || item.id,
          productName: item.productName,
          qty: item.qty,
          unit: item.unit || 'nos',
          rate: itemPrice,
          discount: discountAmount,
          advancePaid: advanceAmount,
          price: itemPrice,
          rowTotal: finalLineTotal,
          type: item.type,
          clientName: item.clientName || null
        };
      }),
      total: Number(Math.max(0, calculateTotals().subtotal - calculateTotals().discount).toFixed(2)),
      timestamp: saleDate === new Date().toISOString().split('T')[0] ? new Date().toISOString() : new Date(`${saleDate}T12:00:00Z`).toISOString(),
      paymentMode: paymentMode,
      ...(paymentMode === 'Split' ? { splitPayments } : {})
    };
    // Instant Cloud Save
    if (saveSale) saveSale(newSale);

    // Automatically record income in accounts ledger
    const recordIncome = async () => {
      const balanceAmount = calculateTotals().total;
      if (balanceAmount > 0) {
        try {
          if (paymentMode === 'Split') {
            const splitInserts = [];
            for (const [method, amount] of Object.entries(splitPayments)) {
              if (parseFloat(amount) > 0) {
                splitInserts.push({
                  type: 'Income',
                  date: saleDate,
                  category: 'Sales',
                  amount: parseFloat(amount),
                  payment_mode: method,
                  reference: `Sale #${newSale.saleId}`,
                  notes: `Auto-generated from completed sale for ${newSale.client.name} (Split - ${method})`
                });
              }
            }
            if (splitInserts.length > 0) {
              await supabase.from('erp_accounts').insert(splitInserts);
            }
          } else {
            await supabase.from('erp_accounts').insert([{
              type: 'Income',
              date: saleDate,
              category: 'Sales',
              amount: balanceAmount,
              payment_mode: paymentMode,
              reference: `Sale #${newSale.saleId}`,
              notes: `Auto-generated from completed sale for ${newSale.client.name}`
            }]);
          }
        } catch (err) {
          console.error("Auto account insert failed", err);
        }
      }
    };
    recordIncome();

    setSales([...sales, newSale]);
    setShowReceipt(newSale);

    if (showGlobalToast) showGlobalToast('Sale Processed', `Sale ${newSale.saleId} for â‚¹${parseFloat(newSale.total).toFixed(2)} (${newSale.client.name})`);

    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
  };

  const handlePrint = async () => {
    if (!showReceipt) return;
    if (showGlobalToast) showGlobalToast('Preparing Receipt', 'Generating your professional bill...');

    const opt = {
      margin: 0,
      filename: `Receipt_${showReceipt.saleId}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'mm', format: [97, 200], orientation: 'portrait' }
    };

    const htmlString = generateReceiptHtmlString(showReceipt);
    const container = document.createElement('div');
    container.innerHTML = htmlString;

    html2pdf().set(opt).from(container.outerHTML).output('blob').then((pdfBlob) => {
      const blobUrl = URL.createObjectURL(pdfBlob);

      // 1. Auto-download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Receipt_${showReceipt.saleId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 2. Auto-print
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          window.open(blobUrl, '_blank');
        }
      };

      if (showGlobalToast) showGlobalToast('Success', 'Receipt downloaded and print view opened.');
    }).catch(err => {
      console.error('PDF Error:', err);
      if (showGlobalToast) showGlobalToast('Export Failed', 'Please try again or contact support.');
    }).finally(() => {
      setTimeout(() => {
        document.querySelectorAll('.html2pdf__overlay, .html2pdf__container').forEach(o => o.remove());
      }, 500);
    });
  };

  const handleWhatsApp = async () => {
    if (!showReceipt) return;

    try {
      setIsSendingPdf(true);
      if (showGlobalToast) showGlobalToast('Generating', 'Uploading receipt PDF to secure server...');

      const htmlString = generateReceiptHtmlString(showReceipt);
      const container = document.createElement('div');
      container.innerHTML = htmlString;
      document.body.appendChild(container);
      container.style.position = 'absolute';
      container.style.left = '-9999px';

      const opt = {
        margin: 0,
        filename: `Receipt_${showReceipt.saleId}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: [97, 200], orientation: 'portrait' }
      };

      const fileName = `receipts/${showReceipt.saleId}.pdf`;

      // Use .outerHTML to prevent html2canvas from crashing on live React DOM nodes
      const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
      document.body.removeChild(container);

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.warn('Supabase Upload Error:', uploadError);
        alert(`Upload Error: ${uploadError.message || JSON.stringify(uploadError)}`);
        throw uploadError;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const appUrlObj = new URL('https://erp.malka.co.in');
      appUrlObj.pathname = `/bill/${encryptId(showReceipt.saleId)}`;
      const finalAppUrl = appUrlObj.toString();
      const greeting = "Thank you for choosing Malka! Your elegance is our priority.";
      let message = `*âœ¨ INVOICE: ${showReceipt.saleId} âœ¨*\n`;
      message += `------------------------------\n`;
      message += `Hello *${showReceipt.client.name}*,\n`;
      message += `${greeting}\n\n`;

      message += `*ORDER SUMMARY:*\n`;
      showReceipt.items.forEach(item => {
        const itemPrice = parseFloat(item.price || 0).toFixed(2);
        const clientSuffix = item.clientName ? ` (Client: ${item.clientName})` : '';
        message += `* ${item.productName}${clientSuffix} (x${item.qty}) - â‚¹${itemPrice}\n`;
      });

      const grandTotal = parseFloat(showReceipt.total || 0).toFixed(2);
      message += `\nGrand Total: *â‚¹${grandTotal}*\n`;
      message += `------------------------------\n`;
      message += `ðŸ“„ *View Digital Receipt:*\n${finalAppUrl}\n\n`;
      message += `Visit again for more unique designs!\n`;
      message += `*Malka - Your Complete Destination For Timeless Style*`;

      const phone = showReceipt.client.phone ? showReceipt.client.phone.replace(/[^0-9]/g, '') : '';
      const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      console.error('WhatsApp Share Error:', err);
      const appUrlObj = new URL('https://erp.malka.co.in');
      appUrlObj.pathname = `/bill/${encryptId(showReceipt.saleId)}`;
      const finalAppUrl = appUrlObj.toString();
      const greeting = "Thank you for choosing Malka! Your elegance is our priority.";
      let message = `*âœ¨ INVOICE: ${showReceipt.saleId} âœ¨*\n`;
      message += `------------------------------\n`;
      message += `Hello *${showReceipt.client.name}*,\n`;
      message += `${greeting}\n\n`;
      message += `*ORDER SUMMARY:*\n`;
      showReceipt.items.forEach(item => {
        const itemPrice = parseFloat(item.price || 0).toFixed(2);
        const clientSuffix = item.clientName ? ` (Client: ${item.clientName})` : '';
        message += `* ${item.productName}${clientSuffix} (x${item.qty}) - â‚¹${itemPrice}\n`;
      });
      const grandTotalFallback = parseFloat(showReceipt.total || 0).toFixed(2);
      message += `\nGrand Total: *â‚¹${grandTotalFallback}*\n`;
      message += `------------------------------\n`;
      message += `ðŸ“„ *View Digital Receipt:*\n${finalAppUrl}\n\n`;
      message += `Visit again for more unique designs!\n`;
      message += `*Malka - Your Complete Destination For Timeless Style*`;

      const phone = showReceipt.client.phone ? showReceipt.client.phone.replace(/[^0-9]/g, '') : '';
      const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');

      if (showGlobalToast) showGlobalToast('Warning', 'Bill sent without PDF link (Supabase storage not ready).');
    } finally {
      setIsSendingPdf(false);
      // CLEANUP stuck html2pdf overlays
      setTimeout(() => {
        const stuckOverlays = document.querySelectorAll('.html2pdf__overlay');
        stuckOverlays.forEach(o => o.remove());
      }, 500);
    }
  };

  const handleSMS = () => {
    if (!showReceipt) return;

    let itemsText = showReceipt.items.map(item => `${item.productName} (x${item.qty}) - â‚¹${item.price}`).join(', ');

    const subtotal = showReceipt.items.reduce((s, i) => s + (i.rate * i.qty), 0);
    const totDisc = showReceipt.items.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);

    let message = `Hi ${showReceipt.client.name}, %0a%0a`;
    message += `Items: ${itemsText}%0a`;
    message += `Total Amount: â‚¹${subtotal.toFixed(2)}%0a`;
    if (totDisc > 0) message += `Discount: -â‚¹${totDisc.toFixed(2)}%0a`;
    message += `Grand Total: â‚¹${parseFloat(showReceipt.total).toFixed(2)}%0a%0a`;
    message += `Thank you for shopping!%0a`;
    message += `Your elegance is our priority.%0a`;
    message += `Please visit again for more unique designs.%0a%0a`;
    message += `Digital Receipt: https://erp.malka.co.in/bill/${encryptId(showReceipt.saleId)}`;

    const phone = showReceipt.client.phone ? showReceipt.client.phone.replace(/[^0-9]/g, '') : '';
    window.location.href = `sms:${phone}?body=${message}`;
  };

  const handleShare = async () => {
    if (!showReceipt) return;
    if (showGlobalToast) showGlobalToast('Preparing Share', 'Generating PDF for sharing...');

    const subtotal = showReceipt.items.reduce((s, i) => s + (i.rate * i.qty), 0);
    const totDisc = showReceipt.items.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);

    const container = document.createElement('div');
    container.style.width = '97mm';
    container.style.padding = '5mm';
    container.style.color = '#000';
    container.style.fontFamily = 'monospace';

    let itemsHtml = showReceipt.items.map(item => `
      <tr>
        <td style="padding: 4px 4px 4px 0; border-bottom: 1px dashed #eee;">
          <div style="font-weight: bold; font-size: 11px;">${item.productName.replace(/\s*\(Order #[^)]+\)/g, '')}</div>
          <div style="font-size: 12px; font-weight: 700; color: #666; margin-top: 1px;">Rate: â‚¹${item.rate}</div>
        </td>
        <td style="text-align: center; font-size: 11px; padding: 4px 4px;">${item.qty}</td>
        <td style="text-align: right; font-size: 11px; padding: 4px 4px;">â‚¹${parseFloat(item.discount || 0).toFixed(0)}</td>
        <td style="text-align: right; font-size: 11px; font-weight: bold; padding: 4px 0 4px 4px;">â‚¹${parseFloat(item.rowTotal || (item.qty * item.rate) - (item.discount || 0)).toFixed(2)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
        <h2 style="margin: 0; font-size: 20px; text-transform: uppercase;">Malka</h2>
        <p style="margin: 2px 0; font-size: 10px;">Your Complete Destination For Timeless Style</p>
        <p style="margin: 2px 0; font-size: 10px;">Ph : 8606154015</p>
      </div>
      <div style="margin-bottom: 15px; font-size: 11px;">
        <p style="margin: 2px 0;"><strong>Customer:</strong> ${showReceipt.client.name}</p>
        <p style="margin: 2px 0;"><strong>Bill:</strong> ${showReceipt.saleId}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
          <tr style="border-bottom: 1px dashed #000; font-size: 10px; text-align: left;">
            <th style="padding: 5px 4px 5px 0;">Item</th>
            <th style="text-align: center; padding: 5px 4px;">Qty</th>
            <th style="text-align: right; padding: 5px 4px;">Disc</th>
            <th style="text-align: right; padding: 5px 0 5px 4px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; font-weight: bold; text-align: right;">
        <div style="font-size: 10px; font-weight: normal; margin-bottom: 2px;">Subtotal: â‚¹${subtotal.toFixed(2)}</div>
        ${totDisc > 0 ? `<div style="font-size: 10px; font-weight: normal; margin-bottom: 2px;">Discount: -â‚¹${totDisc.toFixed(2)}</div>` : ''}
        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">Grand Total: â‚¹${parseFloat(showReceipt.total).toFixed(2)}</div>
      </div>
    `;

    const opt = {
      margin: 0,
      filename: `Receipt_${showReceipt.saleId}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: [97, 150], orientation: 'portrait' }
    };

    try {
      const pdfBlob = await html2pdf().set(opt).from(container.outerHTML).output('blob');
      const file = new File([pdfBlob], `Bill_${showReceipt.saleId}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Malka Bill',
          text: `Hi ${showReceipt.client.name}, here is your bill from Malka.`
        });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bill_${showReceipt.saleId}.pdf`;
        a.click();
        if (showGlobalToast) showGlobalToast('Download Started', 'Sharing not supported on this device.');
      }
    } catch (err) {
      console.error('Share error:', err);
      if (showGlobalToast) showGlobalToast('Error', 'Could not share the file.');
    }
  };



  return (
    <div style={themeStyle} className="space-y-6">


      {/* View Item Details Modal */}
      {viewItem && (() => {
        const isOrder = viewItem.type === 'order';
        const orderDetail = isOrder ? (orders || []).find(o => o.id === viewItem.orderId) : null;

        return (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewItem(null)}></div>
            <div className="relative w-full max-w-lg rounded-[32px] bg-[var(--surface)] p-8 shadow-2xl border border-[var(--border)] animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setViewItem(null)}
                className="absolute top-6 right-6 h-10 w-10 grid place-items-center rounded-xl hover:bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--text)]">
                    {isOrder ? `Order Details (#${viewItem.orderId})` : 'Product Details'}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {isOrder ? 'Finished Order' : 'Inventory Item'}
                  </span>
                </div>
              </div>

              {isOrder && orderDetail ? (
                <div className="space-y-5">
                  {/* Card 1: Client & Status */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Client Info</p>
                        <p className="font-bold text-[var(--text)] text-base mt-0.5">{orderDetail.clientName}</p>
                      </div>
                      <span className="rounded-xl bg-green-50 px-3 py-1 text-xs font-bold text-green-600 border border-green-200">
                        {orderDetail.status || 'Completed'}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-[var(--border)] pt-2.5 flex justify-between items-center text-xs text-[var(--muted)]">
                      <span>Delivery: <strong className="text-[var(--text)]">{orderDetail.deliveryDate}</strong></span>
                      <span>Order Date: <strong className="text-[var(--text)]">{orderDetail.orderDate}</strong></span>
                    </div>
                  </div>

                  {/* Card 2: Product & Stitching Cost (Estimate) */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Item Details</p>
                        <p className="font-extrabold text-[var(--text)] text-lg mt-0.5">{orderDetail.product}</p>
                        <p className="text-xs text-[var(--muted)]">{orderDetail.orderType} â€¢ Qty: {viewItem.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Stitching Cost (Estimate)</p>
                        <p className="font-black text-[var(--accent)] text-xl mt-0.5">â‚¹{parseFloat(orderDetail.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Materials Card (If internal) */}
                  {orderDetail.sourceOfMaterial === 'Internal' && orderDetail.internalItems && orderDetail.internalItems.length > 0 && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 space-y-3">
                      <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Used Internal Materials</p>
                      <div className="space-y-2">
                        {orderDetail.internalItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs border-b border-[var(--border)] last:border-0 pb-1.5 last:pb-0">
                            <div>
                              <p className="font-bold text-[var(--text)]">{item.productName}</p>
                              <p className="text-[10px] text-[var(--muted)]">Qty: {item.quantity} {item.unit}</p>
                            </div>
                            <p className="font-semibold text-[var(--accent)]">â‚¹{(item.totalPrice || 0).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-dashed border-[var(--border)] pt-2.5 flex justify-between items-center text-xs font-bold text-[var(--accent)]">
                        <span>Materials Total</span>
                        <span>â‚¹{orderDetail.internalItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Photos Section */}
                  {(orderDetail.photo || orderDetail.materialPhoto) && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Reference & Material Photos</p>
                      <div className="grid grid-cols-2 gap-4">
                        {orderDetail.photo ? (
                          <div className="relative group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
                            <img
                              src={orderDetail.photo}
                              alt="Design Ref"
                              className="h-32 w-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                              onClick={() => setImagePopup(orderDetail.photo)}
                            />
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold">Design Ref</div>
                          </div>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)] text-[10px] text-[var(--muted)]">
                            No design reference
                          </div>
                        )}
                        {orderDetail.materialPhoto ? (
                          <div className="relative group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
                            <img
                              src={orderDetail.materialPhoto}
                              alt="Material Fabric"
                              className="h-32 w-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                              onClick={() => setImagePopup(orderDetail.materialPhoto)}
                            />
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold">Material Fabric</div>
                          </div>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)] text-[10px] text-[var(--muted)]">
                            No fabric photo
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes Card */}
                  {orderDetail.notes && (
                    <div className="rounded-2xl bg-[var(--soft)] p-4 border border-[var(--border)]">
                      <p className="text-xs font-bold uppercase text-[var(--muted)] mb-1 flex items-center gap-1">
                        <Info size={12} className="text-[var(--accent)]" /> Notes / Special Instructions
                      </p>
                      <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap">{orderDetail.notes}</p>
                    </div>
                  )}
                </div>
              ) : !isOrder ? (
                // Inventory Item Details
                <div className="space-y-5">
                  {/* Card 1: Core Details */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Product Name</p>
                      <p className="font-extrabold text-[var(--text)] text-lg mt-0.5">{viewItem.productName}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">ID: {viewItem.productId || viewItem.id}</p>
                    </div>
                    <div className="border-t border-dashed border-[var(--border)] pt-2.5 flex justify-between items-center text-xs text-[var(--muted)]">
                      <span>Category: <strong className="text-[var(--text)]">{viewItem.productType || 'N/A'}</strong></span>
                      <span>Vendor: <strong className="text-[var(--text)]">{viewItem.vendorName || 'No Vendor'}</strong></span>
                    </div>
                  </div>

                  {/* Card 2: Stock & Pricing */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Available Stock</p>
                        <p className="font-extrabold text-[var(--text)] text-base mt-0.5">{viewItem.quantity} {viewItem.unit || 'nos'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Price (Per Unit)</p>
                        <p className="font-black text-[var(--accent)] text-xl mt-0.5">â‚¹{parseFloat(viewItem.finalPrice || viewItem.rate || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Notes Card */}
                  {viewItem.note && (
                    <div className="rounded-2xl bg-[var(--soft)] p-4 border border-[var(--border)]">
                      <p className="text-xs font-bold uppercase text-[var(--muted)] mb-1 flex items-center gap-1">
                        <Info size={12} className="text-[var(--accent)]" /> Notes
                      </p>
                      <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap">{viewItem.note}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-[var(--muted)] py-4">No detailed information available for this item.</p>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="rounded-2xl bg-[var(--text)] px-6 py-3 font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Change Client Switch Confirmation Modal */}
      {pendingClientSwitch && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-[var(--text)] mb-2 flex items-center gap-2">
              <UsersRound className="text-[var(--accent)]" size={20} />
              Change Client?
            </h3>
            <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
              You have items in your cart. Do you want to change the linked client to <strong>{pendingClientSwitch.name}</strong>?
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  // Cancel: no change
                  setPendingClientSwitch(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:bg-[var(--soft)] transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  // Clear Cart: clear items, link to target client
                  const isNewGuest = !clients.some(c => c.id === pendingClientSwitch.id);
                  if (isNewGuest) {
                    const updatedClients = [...clients, pendingClientSwitch];
                    localStorage.setItem('clients', JSON.stringify(updatedClients));
                    setClients(updatedClients);
                  }
                  setCart([]);
                  setSelectedClient(pendingClientSwitch);
                  setClientSearch(pendingClientSwitch.name);
                  setIsSearchingClient(false);
                  setPendingClientSwitch(null);
                  if (showGlobalToast) showGlobalToast('Cart Cleared', `Switched client to ${pendingClientSwitch.name}`);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold shadow-lg hover:brightness-110 transition"
              >
                Clear Cart
              </button>

              <button
                type="button"
                onClick={() => {
                  // Yes: keep items, link to target client
                  const isNewGuest = !clients.some(c => c.id === pendingClientSwitch.id);
                  if (isNewGuest) {
                    const updatedClients = [...clients, pendingClientSwitch];
                    localStorage.setItem('clients', JSON.stringify(updatedClients));
                    setClients(updatedClients);
                  }
                  setSelectedClient(pendingClientSwitch);
                  setClientSearch(pendingClientSwitch.name);
                  setIsSearchingClient(false);
                  setPendingClientSwitch(null);
                  if (showGlobalToast) showGlobalToast('Client Changed', `Linked cart to ${pendingClientSwitch.name}`);
                }}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold shadow-lg hover:brightness-110 transition"
              >
                Yes, Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Popup */}
      {imagePopup && (
        <div
          className="fixed inset-0 z-[3000] grid place-items-center bg-black/80 px-4 backdrop-blur-sm"
          onClick={() => setImagePopup(null)}
        >
          <div className="relative max-w-full max-h-full p-4">
            <button
              className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white hover:bg-white/40 transition"
              onClick={() => setImagePopup(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <img
              src={imagePopup}
              alt="Zoomed Reference"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Cart Alert Modal (Generic) */}
      {cartAlert && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartAlert(null)}></div>
          <div className="relative w-full max-w-sm rounded-[32px] bg-[var(--surface)] p-8 shadow-2xl border border-[var(--border)] animate-in zoom-in duration-300 text-center">
            <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl mx-auto ${cartAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
              <Package size={32} />
            </div>
            <h3 className="mb-2 text-xl font-bold text-[var(--text)]">{cartAlert.title}</h3>
            <p className="mb-8 text-[var(--muted)] text-sm leading-relaxed">{cartAlert.message}</p>
            <button
              onClick={() => setCartAlert(null)}
              className="w-full rounded-2xl bg-[var(--text)] py-4 font-bold text-white transition hover:brightness-110 shadow-lg"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stock Warning Modal */}
      {stockWarning && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setStockWarning(null)}></div>
          <div className="relative w-full max-w-sm rounded-[32px] bg-[var(--surface)] p-8 shadow-2xl border border-red-100 animate-in zoom-in duration-300">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 mx-auto">
              <Package size={32} />
            </div>
            <h3 className="mb-2 text-center text-xl font-bold text-[var(--text)]">Insufficient Stock</h3>
            <p className="mb-8 text-center text-[var(--muted)] text-sm leading-relaxed">
              Sorry! <span className="font-bold text-[var(--text)]">{stockWarning.name}</span> only has <span className="font-bold text-red-500">{stockWarning.stock}</span> units available in inventory.
            </p>
            <button
              onClick={() => setStockWarning(null)}
              className="w-full rounded-2xl bg-[var(--text)] py-4 font-bold text-white transition hover:brightness-110 shadow-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className={`absolute inset-0 bg-black/70 backdrop-blur-md ${isSendingPdf ? 'cursor-wait' : 'cursor-pointer'}`} onClick={() => {
            if (isSendingPdf) return;
            const backPath = sessionStorage.getItem('erp_sales_back');
            sessionStorage.removeItem('erp_sales_back');
            setCurrentPage(backPath || 'view-sales');
          }}></div>
          <div className="relative w-full max-w-2xl rounded-[24px] sm:rounded-[32px] bg-[var(--surface)] p-4 sm:p-8 shadow-2xl animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
            <div className="mb-6 sm:mb-8 flex items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[var(--accent)] mb-1">
                  <CheckCircle size={20} className="shrink-0" />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-widest leading-tight">Transaction Successful</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black">Sales Receipt</h2>
              </div>
              <button
                disabled={isSendingPdf}
                onClick={() => {
                  const backPath = sessionStorage.getItem('erp_sales_back');
                  sessionStorage.removeItem('erp_sales_back');
                  setCurrentPage(backPath || 'view-sales');
                }}
                className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 grid place-items-center rounded-2xl hover:bg-[var(--soft)] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="w-full overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div id="printable-bill" className="mb-4 sm:mb-8 bg-white p-4 text-black shadow-inner overflow-hidden mx-auto shrink-0" style={{ width: '97mm', minHeight: '120mm', fontFamily: 'monospace' }}>
                <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
                  <img src="/logo-black.png" alt="Logo" className="w-28 h-32 mx-auto mb-4 object-contain" />
                  <h3 className="uppercase tracking-tight !text-[24px] !font-extrabold">Malka</h3>
                  <p className="text-[10px] font-medium">Your Complete Destination For Timeless Style</p>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}>Ph : 8606154015</p>
                  <div className="mt-2 text-gray-500">
                    <p className="!text-[10px]">Order ID: {showReceipt.saleId}</p>
                    <p className="!text-[10px]">{new Date(showReceipt.timestamp).toDateString() === new Date().toDateString() ? new Date(showReceipt.timestamp).toLocaleString() : new Date(showReceipt.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-4 text-[11px]">
                  <p className="font-bold">Customer: {showReceipt.client.name}</p>
                  {showReceipt.client.phone && <p>Tel: {showReceipt.client.phone}</p>}
                </div>

                <table className="w-full text-[10px] mb-4">
                  <thead>
                    <tr className="border-b border-dashed border-gray-300 text-left">
                      <th className="py-1 min-w-[100px] pr-2">Item</th>
                      <th className="py-1 text-center px-3">Qty</th>
                      <th className="py-1 text-right px-3 whitespace-nowrap">Disc (â‚¹/%)</th>
                      <th className="py-1 text-right pl-3 whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-gray-200">
                    {showReceipt.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2">
                          <p className="font-bold">{item.productName.replace(/\s*\(Order #[^)]+\)/g, '')}</p>
                          <div className="flex flex-col mt-0.5">
                            <p style={{ fontSize: '12px', fontWeight: 700 }} className="opacity-70">Rate: â‚¹{item.price || item.rate}</p>
                          </div>
                        </td>
                        <td className="py-2 text-center px-3">{item.qty}</td>
                        <td className="py-2 text-right px-3">
                          {item.rowTotal !== undefined ? 'â‚¹' : ''}{item.discount || 0}{item.rowTotal !== undefined ? '' : '%'}
                        </td>
                        <td className="py-2 text-right pl-3 font-bold">
                          â‚¹{parseFloat(item.rowTotal || (item.qty * (item.price || item.rate)) - (item.discount || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1">
                  <div className="flex justify-between text-sm font-black">
                    <span>Grand Total</span>
                    <span>â‚¹{showReceipt.total}</span>
                  </div>
                </div>

                <div className="text-center mt-6 text-[10px] text-gray-500 italic border-t border-dashed border-gray-200 pt-4">
                  <p className="font-bold text-black mb-1">Thank you for shopping!</p>
                  <p>Your elegance is our priority.</p>
                  <p>Please visit again for more unique designs.</p>
                  <p className="mt-2 text-[9px]">This is a computer generated receipt.</p>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)] mb-2">WhatsApp / SMS Number</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={showReceipt.client.phone || ''}
                  onChange={(e) => setShowReceipt({
                    ...showReceipt,
                    client: { ...showReceipt.client, phone: e.target.value }
                  })}
                  placeholder="Enter phone number"
                  className="flex-1 bg-transparent border-b border-[var(--border)] py-2 outline-none text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={handlePrint} className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[var(--border)] py-4 font-bold transition hover:bg-[var(--soft)]">
                <Download size={20} /> Print Bill
              </button>
              <button onClick={handleShare} className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[var(--border)] py-4 font-bold transition hover:bg-[var(--soft)] text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                Share File
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleSMS} className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--text)] py-4 font-bold text-white shadow-xl transition hover:brightness-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Send SMS
              </button>
              <button
                disabled={isSendingPdf}
                onClick={handleWhatsApp}
                className={`flex items-center justify-center gap-3 rounded-2xl bg-[#25D366] py-4 font-bold text-white shadow-xl shadow-[#25D366]/20 transition hover:brightness-95 ${isSendingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="fill-white"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.4 8.38 8.38 0 0 1 3.8.9L22 4Z" /></svg>
                {isSendingPdf ? 'Generating...' : 'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)] mb-1">
            <TrendingUp size={16} /> Checkout Terminal
          </p>
          <h1 className="text-h1">Create Sales</h1>
          <p className="text-para text-[var(--muted)] mt-2">Process boutique inventory or collect cash for finished orders.</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6 min-w-0">
          {/* Selection Source Toggle */}
          <div className="flex flex-wrap gap-2 rounded-2xl bg-[var(--surface-strong)] p-1.5 border border-[var(--border)] w-full sm:w-fit">
            <button
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${selectionMode === 'inventory' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              onClick={() => { setSelectionMode('inventory'); setProductSearch(''); }}
            >
              Inventory Items
            </button>
            <button
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${selectionMode === 'orders' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              onClick={() => { setSelectionMode('orders'); setProductSearch(''); }}
            >
              Finished Orders
            </button>
          </div>

          {/* Quick Add Client Orders Reminder */}
          {selectedClient && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="rounded-[24px] border border-[var(--accent)]/20 bg-[var(--accent-soft)]/20 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--accent)]">
                    Collections for {selectedClient.name}
                  </h4>
                  {orders.filter(o => o.clientName === selectedClient.name && o.status === 'Completed' && !cart.some(ci => ci.orderId === o.id)).length > 0 && (
                    <span className="flex h-5 w-5 animate-bounce items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white shadow-lg">
                      {orders.filter(o => o.clientName === selectedClient.name && o.status === 'Completed' && !cart.some(ci => ci.orderId === o.id)).length}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {orders.filter(o => o.clientName === selectedClient.name && o.status === 'Completed' && !cart.some(ci => ci.orderId === o.id)).map(o => (
                    <button
                      key={o.id}
                      onClick={() => addToCart(o, 'order')}
                      className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm transition-all hover:border-[var(--accent)] hover:shadow-md active:scale-95"
                    >
                      <div className="relative">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-green-500 opacity-75" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-[var(--text)]">{o.product}</p>
                        <p className="text-[10px] font-bold text-[var(--muted)]">Order #{o.id} â€¢ â‚¹{o.price}</p>
                      </div>
                      <Plus size={16} className="text-[var(--accent)] transition-transform group-hover:rotate-90" />
                    </button>
                  ))}

                  {orders.filter(o => o.clientName === selectedClient.name && o.status === 'Completed' && !cart.some(ci => ci.orderId === o.id)).length === 0 && (
                    <div className="flex w-full items-center gap-2 text-xs font-medium text-[var(--muted)] italic py-2">
                      <CheckCircle size={14} className="text-green-500 opacity-50" />
                      No pending collections for this client.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Item Selection */}
          <section className="relative z-30 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
            <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2 whitespace-nowrap">
                <ShoppingCart size={20} className="text-[var(--accent)]" /> {selectionMode === 'inventory' ? 'Stock Selection' : 'Order Collection'}
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto flex-1 xl:justify-end">
                <div className="relative w-full sm:max-w-md flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    placeholder={selectionMode === 'inventory' ? "Click to see items..." : "Click to see orders..."}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2.5 pl-12 pr-4 outline-none focus:border-[var(--accent)]"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsSearchingProduct(true);
                    }}
                    onFocus={() => setIsSearchingProduct(true)}
                  />
                  {isSearchingProduct && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl backdrop-blur">
                      <div className="sticky top-0 z-10 flex justify-between items-center px-4 py-2 bg-[var(--surface-strong)] border-b border-[var(--border)]">
                        <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Select {selectionMode}</span>
                        <button onClick={() => setIsSearchingProduct(false)} className="text-[var(--accent)] text-xs font-bold">Close</button>
                      </div>
                      <div className="p-2">
                        {selectionMode === 'inventory' ? (
                          filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <button
                              key={p.id}
                              className="flex w-full items-center justify-between rounded-xl p-4 text-left transition hover:bg-[var(--soft)]"
                              onClick={() => {
                                addToCart(p, 'inventory');
                                setIsSearchingProduct(false);
                                setProductSearch('');
                              }}
                            >
                              <div>
                                <p className="font-semibold">{p.productName}</p>
                                <p className="text-xs text-[var(--muted)]">Stock: {p.quantity} {p.unit}</p>
                              </div>
                              <p className="font-bold text-[var(--accent)]">â‚¹{p.finalPrice}</p>
                            </button>
                          )) : (
                            <p className="p-4 text-center text-xs text-[var(--muted)]">No inventory items found.</p>
                          )
                        ) : (
                          readyOrders.length > 0 ? readyOrders.map(o => (
                            <button
                              key={o.id}
                              className="flex w-full items-center justify-between rounded-xl p-4 text-left transition hover:bg-[var(--soft)]"
                              onClick={() => {
                                addToCart(o, 'order');
                                setIsSearchingProduct(false);
                                setProductSearch('');
                              }}
                            >
                              <div>
                                <p className="font-semibold">{o.clientName}</p>
                                <p className="text-xs text-[var(--muted)]">Order #{o.id} | {o.product}</p>
                              </div>
                              <p className="font-bold text-[var(--accent)]">â‚¹{o.price}</p>
                            </button>
                          )) : (
                            <p className="p-4 text-center text-xs text-[var(--muted)]">No completed orders found.</p>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCart([...cart, {
                      id: `CUSTOM-${Date.now()}`,
                      productId: '',
                      productName: '',
                      qty: 1,
                      unit: 'nos',
                      finalPrice: 0,
                      discount: 0,
                      advancePaid: 0,
                      type: 'custom',
                    }]);
                  }}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-95 whitespace-nowrap"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>


            <div className="erp-table-container scrollbar-hide" ref={tableContainerRef}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Item Details</th>
                    <th>Qty</th>
                    <th>Rate/Price</th>
                    <th>Deductions</th>
                    <th className="text-right">Total</th>
                    <th className="text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length > 0 ? cart.map((item) => (
                    <tr key={item.id} className="group">
                      <td>
                        {item.type === 'custom' ? (
                          <input
                            type="text"
                            placeholder="Enter description (e.g. Alteration)"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 font-bold text-[var(--text)] text-sm outline-none focus:border-[var(--accent)]"
                            value={item.productName}
                            onChange={(e) => setCart(cart.map(i => i.id === item.id ? { ...i, productName: e.target.value } : i))}
                          />
                        ) : (
                          <p className="font-bold text-[var(--text)]">{item.productName}</p>
                        )}
                        <div className="flex flex-col gap-0.5 mt-1">
                          {item.productId && (
                            <p className="text-[10px] text-[var(--muted)] uppercase tracking-tight font-semibold">
                              ID: {item.productId}
                            </p>
                          )}
                          {item.type === 'order' && (
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-tight">
                              Order for {item.clientName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {item.type === 'inventory' || item.type === 'custom' ? (
                            <input
                              type="number"
                              step="any"
                              className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1 font-bold text-[var(--text)] text-sm"
                              value={item.qty}
                              onChange={(e) => {
                                if (item.type === 'custom') {
                                  setCart(cart.map(i => i.id === item.id ? { ...i, qty: parseFloat(e.target.value) || 0 } : i));
                                } else {
                                  updateQty(item.id, parseFloat(e.target.value) || 0);
                                }
                              }}
                            />
                          ) : <span className="font-bold text-[var(--text)]">{item.qty}</span>}
                          <span className="text-[10px] font-bold text-[var(--muted)] uppercase">{item.unit}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="text-[var(--muted)]">â‚¹</span>
                          <input
                            type="number"
                            className={`w-16 rounded-lg border bg-[var(--surface-strong)] px-2 py-1 font-bold text-[var(--text)] text-sm ${(parseFloat(item.finalPrice) || 0) <= 0 ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--accent)]'}`}
                            value={item.finalPrice}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                            onChange={(e) => updatePrice(item.id, e.target.value)}
                          />
                        </div>
                      </td>
                      <td>
                        {item.type !== 'custom' ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[var(--muted)] w-8 text-right font-semibold uppercase">Disc</span>
                              <input
                                type="number"
                                className="w-14 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-bold text-[var(--accent)] text-xs"
                                value={item.discount}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.target.select()}
                                onChange={(e) => updateDiscount(item.id, e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[var(--muted)] w-8 text-right font-semibold uppercase">Adv</span>
                              <input
                                type="number"
                                className="w-14 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-bold text-green-600 text-xs"
                                value={item.advancePaid || 0}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.target.select()}
                                onChange={(e) => updateAdvancePaid(item.id, e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] uppercase font-bold block text-center opacity-50">-</span>
                        )}
                      </td>
                      <td className="text-right font-bold text-[var(--accent)]">
                        â‚¹{Math.max(0, ((parseFloat(item.finalPrice) || 0) * item.qty) - (parseFloat(item.discount) || 0) - (parseFloat(item.advancePaid) || 0)).toFixed(2)}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.type !== 'custom' && (
                            <button
                              type="button"
                              onClick={() => setViewItem(item)}
                              className="text-[var(--accent)] hover:text-white transition p-2 hover:bg-[var(--accent-soft)] rounded-lg"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" className="text-center text-[var(--muted)] font-medium">No items in cart</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6 min-w-0">
          {/* Sale Date Selection */}
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur z-20 relative">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-[var(--accent)]" /> Sale Date
            </h3>
            <CustomDatePicker
              value={saleDate}
              onChange={(date) => setSaleDate(date)}
              placeholder="Select sale date"
              maxDate={new Date().toISOString().split('T')[0]}
            />
          </section>

          {/* Client Selection */}
          <section className="rounded-[24px] relative z-8 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UsersRound size={20} className="text-[var(--accent)]" /> Client Info
            </h3>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search or add client..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2.5 pl-12 pr-4 outline-none focus:border-[var(--accent)]"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setIsSearchingClient(true);
                }}
                onFocus={() => setIsSearchingClient(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (filteredClients.length > 0) {
                      const c = filteredClients[0];
                      if (selectedClient && selectedClient.id !== c.id && cart.length > 0) {
                        setPendingClientSwitch(c);
                      } else {
                        setSelectedClient(c);
                        setClientSearch(c.name);
                        setIsSearchingClient(false);
                      }
                    } else if (clientSearch) {
                      handleAddGuest();
                    }
                  }
                }}
              />
              {isSearchingClient && (
                <div className="absolute top-full left-0 right-0 z-[100] mt-2 max-h-60 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl">
                  <div className="sticky top-0 z-10 flex justify-between items-center px-3 py-2 bg-[var(--surface-strong)] border-b border-[var(--border)]">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Select Client</span>
                    <button onClick={() => setIsSearchingClient(false)} className="text-[var(--accent)] text-xs font-bold">Close</button>
                  </div>
                  <div className="p-2">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        className="flex w-full items-center justify-between rounded-xl p-3 text-left transition hover:bg-[var(--soft)]"
                        onClick={() => {
                          if (selectedClient && selectedClient.id !== c.id && cart.length > 0) {
                            setPendingClientSwitch(c);
                          } else {
                            setSelectedClient(c);
                            setClientSearch(c.name);
                            setIsSearchingClient(false);
                          }
                        }}
                      >
                        <div>
                          <p className="font-semibold text-sm">{c.name}</p>
                          <p className="text-[10px] text-[var(--muted)]">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                    {clientSearch && filteredClients.length === 0 && (
                      <button
                        className="flex w-full items-center gap-2 rounded-xl bg-[var(--accent-soft)] p-3 text-left text-sm font-bold text-[var(--accent)] transition hover:brightness-95"
                        onClick={handleAddGuest}
                      >
                        <Plus size={16} />
                        {/^[0-9]+$/.test(clientSearch) ? `Use Phone: ${clientSearch}` : `Add "${clientSearch}" as Guest`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--accent-soft)] p-3 border border-[var(--accent)]/10">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--accent)] opacity-70">Linking Sale To</p>
                  <p className="font-bold text-[var(--accent)]">{selectedClient.name}</p>
                </div>
                <button onClick={() => { setSelectedClient(null); setCart([]); setClientSearch(''); }} className="text-[var(--accent)] hover:scale-110 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}
          </section>

          {/* Payment Summary & Mode */}
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] backdrop-blur">
            <h3 className="text-lg font-bold mb-6">Payment Summary</h3>
            <div className="mb-6">
              <span className="text-sm font-medium text-[var(--text)] block mb-3">Payment Mode</span>
              <div ref={paymentScrollRef} className="flex overflow-x-auto gap-2 pb-1 cursor-grab [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Split'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition border ${paymentMode === mode ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20' : 'bg-[var(--surface-strong)] border-[var(--border)] text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            {paymentMode === 'Split' && (
              <div className="mb-6 rounded-2xl bg-[var(--soft)] p-4 border border-[var(--border)] animate-in fade-in zoom-in duration-300">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] mb-3">Split Amounts</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.keys(splitPayments).map(method => (
                    <div key={method} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--muted)] w-20">{method}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-bold">â‚¹</span>
                        <input
                          type="number"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2 pl-7 pr-3 text-sm font-bold outline-none focus:border-[var(--accent)]"
                          value={splitPayments[method] || ''}
                          onChange={(e) => setSplitPayments({ ...splitPayments, [method]: parseFloat(e.target.value) || 0 })}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3">
                  <span className="text-xs font-bold text-[var(--muted)]">Allocated: â‚¹{Object.values(splitPayments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0).toFixed(2)}</span>
                  <span className={`text-xs font-bold ${Math.abs(Object.values(splitPayments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0) - calculateTotals().total) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                    Remaining: â‚¹{(calculateTotals().total - Object.values(splitPayments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Total Items</span>
                <span className="font-bold">{cart.reduce((s, i) => s + i.qty, 0)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-4 mt-2">
                <span className="text-[var(--muted)]">Total Amount</span>
                <span className="font-semibold">â‚¹{calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              {calculateTotals().discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Total Discount</span>
                  <span className="font-semibold text-red-500">- â‚¹{calculateTotals().discount.toFixed(2)}</span>
                </div>
              )}
              {calculateTotals().advance > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Advance Paid</span>
                  <span className="font-semibold text-green-600">- â‚¹{calculateTotals().advance.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-[var(--border)] pt-4 mt-2">
                <span className="text-lg font-bold">Balance (Grand Total)</span>
                <span className="text-3xl font-black text-[var(--accent)]">â‚¹{calculateTotals().total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-white shadow-xl shadow-[var(--accent)]/30 transition hover:brightness-95 disabled:opacity-50"
              >
                Complete Transaction
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CreateSalesPage;


