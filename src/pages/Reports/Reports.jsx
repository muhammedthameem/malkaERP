import React, { useState, useEffect, useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ShoppingBag, TrendingUp, UsersRound, Download, Clock, BarChart3, CircleDollarSign, TrendingDown, ChevronDown } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { Virtuoso } from 'react-virtuoso'
import { formatDateDDMMYY, orders } from '../../utils/constants'
import ReportStatCard from '../../components/ReportStatCard'
import supabase from '../../supabase'

function ReportsPage({ themeStyle, showGlobalToast, sales, orders, clients, inventory, cloudLoaded }) {
  const [filter, setFilter] = useState('all'); // all, today, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [expandedPurchaseId, setExpandedPurchaseId] = useState(null);
  const [expandedSalesId, setExpandedSalesId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedIncomeId, setExpandedIncomeId] = useState(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase.from('erp_accounts').select('*');
        if (error) throw error;
        setAccounts(data || []);
      } catch (err) {
        console.error("Error fetching accounts:", err);
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const isDataLoading = (!cloudLoaded && (!sales || !orders || !clients || !inventory)) || accountsLoading;

  // Pagination State
  const [salesPage, setSalesPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    // Reset pages when filter changes
    setSalesPage(1);
    setOrdersPage(1);
    setIncomePage(1);
    setExpensePage(1);
  }, [filter, startDate, endDate]);

  const getFilteredData = (data) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return data.filter(item => {
      const dateStr = item.date || item.timestamp || item.createdAt || item.orderDate;
      if (!dateStr) return true;
      const itemDate = new Date(dateStr).getTime();

      if (filter === 'today') return itemDate >= today;
      if (filter === 'month') return itemDate >= firstOfMonth;
      if (filter === 'custom' && startDate && endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      }
      return true;
    }).sort((a, b) => {
      const dateA = a.date || a.timestamp || a.createdAt || a.orderDate;
      const dateB = b.date || b.timestamp || b.createdAt || b.orderDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  };

  const filteredSales = getFilteredData(sales);
  const filteredOrders = getFilteredData(orders);
  const filteredInventory = getFilteredData(inventory);
  const filteredAccounts = getFilteredData(accounts);

  const filteredIncome = filteredAccounts.filter(a => a.type === 'Income');
  const filteredExpense = filteredAccounts.filter(a => a.type === 'Expense');

  // Build lookup: orderId -> sale price from sales data
  const saleOrderPrices = {};
  (sales || []).forEach(s => {
    (s.items || []).forEach(item => {
      const orderId = item.orderId || (item.id && item.id.toString().startsWith('ORD-') ? item.id.toString().replace('ORD-', '') : null);
      if (orderId) {
        saleOrderPrices[orderId] = parseFloat(item.price ?? item.rate ?? 0);
      }
    });
  });

  // Paginated Data
  const paginatedSales = filteredSales.slice((salesPage - 1) * itemsPerPage, salesPage * itemsPerPage);
  const paginatedOrders = filteredOrders.slice((ordersPage - 1) * itemsPerPage, ordersPage * itemsPerPage);
  const paginatedIncome = filteredIncome.slice((incomePage - 1) * itemsPerPage, incomePage * itemsPerPage);
  const paginatedExpense = filteredExpense.slice((expensePage - 1) * itemsPerPage, expensePage * itemsPerPage);

  const totalSalesPages = Math.ceil(filteredSales.length / itemsPerPage);
  const totalOrdersPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const totalIncomePages = Math.ceil(filteredIncome.length / itemsPerPage);
  const totalExpensePages = Math.ceil(filteredExpense.length / itemsPerPage);

  const reportStats = {
    totalRevenue: filteredSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
    totalInvestment: filteredInventory.reduce((sum, i) => sum + (parseFloat(i.purchasePrice || 0) * (parseFloat(i.initialQuantity || i.quantity) || 0)), 0),
    salesCount: filteredSales.length,
    pendingOrders: filteredOrders.filter(o => o.status === 'Not Ready' || o.status === 'Pending').length,
    totalClients: clients.length,
    totalIncome: filteredIncome.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0),
    totalExpense: filteredExpense.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0)
  };

  const downloadPDF = () => {
    if (showGlobalToast) showGlobalToast('Generating Report', 'Building your professional business report...');

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.color = '#111827';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    let html = `
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #8e4431; padding-bottom: 20px;">
        <h1 style="margin: 0; color: #8e4431; font-size: 28px; letter-spacing: 2px;">Malka Boutique</h1>
        <p style="margin: 5px 0 0 0; color: #6b7280; text-transform: uppercase; font-size: 12px; font-weight: 700; letter-spacing: 1px;">Business Intelligence Report</p>
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #374151;">Filter: <strong>${filter.toUpperCase()}</strong> | Date: <strong>${new Date().toLocaleDateString()}</strong></p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px;">
        <div style="background: #f0fdf4; border: 1px solid #bcf0da; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #166534; font-weight: 800; text-transform: uppercase;">Total Revenue</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #14532d;">â‚¹${reportStats.totalRevenue.toLocaleString()}</p>
        </div>
        <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #1e40af; font-weight: 800; text-transform: uppercase;">Sales Count</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #1e3a8a;">${reportStats.salesCount}</p>
        </div>
        <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #9a3412; font-weight: 800; text-transform: uppercase;">Pending Orders</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #7c2d12;">${reportStats.pendingOrders}</p>
        </div>
        <div style="background: #faf5ff; border: 1px solid #f3e8ff; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #6b21a8; font-weight: 800; text-transform: uppercase;">Purchase Investment</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #581c87;">â‚¹${reportStats.totalInvestment.toLocaleString()}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px;">
        <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #0f766e; font-weight: 800; text-transform: uppercase;">Other Income</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #0f766e;">â‚¹${reportStats.totalIncome.toLocaleString()}</p>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #b91c1c; font-weight: 800; text-transform: uppercase;">Other Expenses</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #b91c1c;">â‚¹${reportStats.totalExpense.toLocaleString()}</p>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="font-size: 16px; color: #111827; border-left: 4px solid #8e4431; padding-left: 12px; margin-bottom: 20px;">Purchase & Inventory Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Product</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Vendor</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Purchase Cost</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInventory.length > 0 ? filteredInventory.map(i => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${new Date(i.createdAt).toLocaleDateString()}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${i.productName}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${i.vendorName || 'N/A'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">â‚¹${(parseFloat(i.purchasePrice || 0) * (parseFloat(i.quantity) || 0)).toLocaleString()}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">No purchase records found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="font-size: 16px; color: #111827; border-left: 4px solid #8e4431; padding-left: 12px; margin-bottom: 20px;">Sales Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Sale ID</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Customer</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.length > 0 ? filteredSales.map(s => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${new Date(s.timestamp).toLocaleDateString()}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-family: monospace; font-weight: bold;">${s.saleId}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${s.client?.name || 'Guest'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">â‚¹${parseFloat(s.total).toFixed(2)}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">No sales records found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style="font-size: 16px; color: #111827; border-left: 4px solid #8e4431; padding-left: 12px; margin-bottom: 20px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Order ID</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Product</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Status</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #4b5563;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.length > 0 ? filteredOrders.map(o => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 11px;">${formatDateDDMMYY(o.orderDate)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">#${o.id}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${o.product}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
                  <span style="background: ${o.status === 'Completed' ? '#dcfce7' : o.status === 'Sold' ? '#f3e8ff' : o.status === 'In Progress' ? '#dbeafe' : o.status === 'Hold' ? '#ffedd5' : '#f3f4f6'}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: ${o.status === 'Completed' ? '#166534' : o.status === 'Sold' ? '#6b21a8' : o.status === 'In Progress' ? '#1e40af' : o.status === 'Hold' ? '#9a3412' : '#4b5563'};">${o.status}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">${o.status === 'Sold' && saleOrderPrices[o.id] ? 'â‚¹' + saleOrderPrices[o.id] : o.price}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">No order records found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 60px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px;">
        Generated by Malka ERP System | Â© ${new Date().getFullYear()}
      </div>
    `;

    container.innerHTML = html;

    const opt = {
      margin: 10,
      filename: `malka_Boutique_Report_${filter}_${new Date().toLocaleDateString()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
      if (showGlobalToast) showGlobalToast('Download Complete', 'Business report saved successfully.');
    });
  };

  const downloadCSV = (type) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (type === 'sales') {
      csvContent += "Date,Sale ID,Customer,Total\n";
      filteredSales.forEach(s => {
        csvContent += `${new Date(s.timestamp).toLocaleDateString()},${s.saleId},${s.client?.name || 'Guest'},${s.total}\n`;
      });
    } else if (type === 'orders') {
      csvContent += "Date,Order ID,Customer,Product,Status,Price\n";
      filteredOrders.forEach(o => {
        const soldPrice = o.status === 'Sold' && saleOrderPrices[o.id] ? saleOrderPrices[o.id] : o.price;
        csvContent += `${o.orderDate},${o.id},${o.clientName},${o.product},${o.status},${soldPrice}\n`;
      });
    } else if (type === 'inventory') {
      csvContent += "Date,Product ID,Product Name,Vendor,Purchase Price,Quantity,Total Purchase\n";
      filteredInventory.forEach(i => {
        csvContent += `${new Date(i.createdAt).toLocaleDateString()},${i.productId},${i.productName},${i.vendorName || ''},${i.purchasePrice},${i.quantity},${parseFloat(i.purchasePrice || 0) * (parseFloat(i.quantity) || 0)}\n`;
      });
    } else if (type === 'income') {
      csvContent += "Date,Category,Reference,Amount\n";
      filteredIncome.forEach(i => {
        csvContent += `${new Date(i.date).toLocaleDateString()},${i.category},${i.reference || ''},${i.amount}\n`;
      });
    } else if (type === 'expense') {
      csvContent += "Date,Category,Reference,Amount\n";
      filteredExpense.forEach(e => {
        csvContent += `${new Date(e.date).toLocaleDateString()},${e.category},${e.reference || ''},${e.amount}\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type}_report_${filter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showGlobalToast) showGlobalToast('Report Downloaded', `${type.toUpperCase()} report is ready.`);
  };

  return (
    <div style={themeStyle} className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)] mb-1">
            <BarChart3 size={16} /> Business Analytics
          </p>
          <h1 className="text-h1">Reports & Insights</h1>
          <p className="text-para text-[var(--muted)] mt-2">Analyze your boutique performance and financial growth.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full lg:w-auto">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`flex-1 sm:flex-none px-3 sm:px-5 h-11 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${filter === btn.id ? 'bg-[var(--accent)] text-white shadow-lg' : 'bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto">
            <button
              onClick={downloadPDF}
              className="flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-95 active:scale-95 whitespace-nowrap"
            >
              <Download size={18} /> Export Full Report
            </button>
          </div>
        </div>

        {filter === 'custom' && (
          <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:items-end gap-4 sm:gap-6 pt-4 border-t border-[var(--border)]/50 animate-in fade-in duration-300">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Start Date</p>
              <div className="relative">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--accent)]" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">End Date</p>
              <div className="relative">
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--accent)]" 
                />
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[var(--accent-soft)]/30 p-4 sm:p-3 rounded-2xl sm:col-span-2 lg:col-span-1 mt-2 sm:mt-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-lg">
                <CalendarDays size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-tighter text-[var(--accent)]">Data Range Active</p>
                <p className="text-xs font-medium text-[var(--text)]">Showing insights between selected dates</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Wrapper */}
      <div id="report-content" className="space-y-8 p-1">
        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isDataLoading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-32 rounded-[24px]" />
            ))
          ) : (
            <>
              <ReportStatCard icon={<TrendingUp className="text-green-500" />} label="Total Revenue" value={`â‚¹${reportStats.totalRevenue.toLocaleString()}`} color="green" />
              <ReportStatCard icon={<ShoppingBag className="text-blue-500" />} label="Total Purchase" value={`â‚¹${reportStats.totalInvestment.toLocaleString()}`} color="red" />
              <ReportStatCard icon={<Clock className="text-orange-500" />} label="Pending Orders" value={reportStats.pendingOrders} color="orange" />
              <ReportStatCard icon={<UsersRound className="text-purple-500" />} label="Customers" value={reportStats.totalClients} color="purple" />
              <ReportStatCard icon={<CircleDollarSign className="text-teal-500" />} label="Other Income" value={`â‚¹${reportStats.totalIncome.toLocaleString()}`} color="teal" />
              <ReportStatCard icon={<TrendingDown className="text-red-500" />} label="Other Expense" value={`â‚¹${reportStats.totalExpense.toLocaleString()}`} color="red" />
            </>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-1">
          {/* Purchase & Inventory Analysis */}
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-h3">Purchase Analysis</h3>
                <p className="text-xs text-[var(--muted)]">Filtered entries: {filteredInventory.length}</p>
              </div>
              <button onClick={() => downloadCSV('inventory')} className="flex items-center gap-2 rounded-xl bg-[var(--soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="erp-table-container hidden lg:block">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Vendor</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td><div className="skeleton h-4 w-20 rounded" /></td>
                        <td><div className="skeleton h-5 w-32 rounded" /></td>
                        <td><div className="skeleton h-5 w-24 rounded" /></td>
                        <td className="text-right"><div className="skeleton h-5 w-16 rounded ml-auto" /></td>
                        <td className="text-right"><div className="skeleton h-5 w-16 rounded ml-auto" /></td>
                        <td className="text-right"><div className="skeleton h-6 w-20 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredInventory.map(i => (
                    <tr key={i.id}>
                      <td>{new Date(i.createdAt).toLocaleDateString()}</td>
                      <td className="font-bold">{i.productName}</td>
                      <td className="font-medium text-[var(--muted)]">{i.vendorName || 'N/A'}</td>
                      <td className="text-right">â‚¹{parseFloat(i.purchasePrice || 0).toFixed(2)}</td>
                      <td className="text-right">{i.initialQuantity || i.quantity} {i.unit}</td>
                      <td className="text-right font-black text-red-500">â‚¹{(parseFloat(i.purchasePrice || 0) * (parseFloat(i.initialQuantity || i.quantity) || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && !isDataLoading && (
                    <tr>
                      <td colSpan="6" className="text-center text-[var(--muted)]">No purchase records found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="block lg:hidden mt-4 h-[50vh] -mx-4 px-4">
              <Virtuoso
                data={filteredInventory}
                overscan={200}
                itemContent={(index, i) => {
                  const isExpanded = expandedPurchaseId === i.id;
                  return (
                    <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300 mx-4`}>
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedPurchaseId(isExpanded ? null : i.id)}
                      >
                        <div className="flex flex-col gap-1 w-full max-w-[65%]">
                          <span className="font-bold text-sm text-[var(--accent)] truncate">{i.productName}</span>
                          <span className="text-[10px] font-semibold text-[var(--muted)]">{new Date(i.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-black text-red-500 text-sm">â‚¹{(parseFloat(i.purchasePrice || 0) * (parseFloat(i.quantity) || 0)).toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-[var(--muted)]">{i.quantity} {i.unit}</span>
                          </div>
                          <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Vendor:</span>
                              <span className="font-medium text-[var(--text)]">{i.vendorName || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Unit Cost:</span>
                              <span className="font-bold text-[var(--text)]">â‚¹{parseFloat(i.purchasePrice || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Sales Analysis Table */}
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-h3">Sales Analysis</h3>
                <p className="text-xs text-[var(--muted)]">Filtered results: {filteredSales.length}</p>
              </div>
              <button onClick={() => downloadCSV('sales')} className="flex items-center gap-2 rounded-xl bg-[var(--soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="erp-table-container hidden lg:block">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sale ID</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td><div className="skeleton h-4 w-20 rounded" /></td>
                        <td><div className="skeleton h-5 w-24 rounded" /></td>
                        <td><div className="skeleton h-5 w-32 rounded" /></td>
                        <td className="text-right"><div className="skeleton h-6 w-20 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : paginatedSales.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.timestamp).toLocaleDateString()}</td>
                      <td className="font-mono font-bold text-[var(--muted)]">{s.saleId}</td>
                      <td className="font-medium">{s.client?.name || 'Guest'}</td>
                      <td className="text-right font-black text-[var(--accent)]">â‚¹{parseFloat(s.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  {paginatedSales.length === 0 && !isDataLoading && (
                    <tr>
                      <td colSpan="4" className="text-center text-[var(--muted)]">No sales found for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="block lg:hidden mt-4 h-[50vh] -mx-4 px-4">
              <Virtuoso
                data={filteredSales}
                overscan={200}
                itemContent={(index, s) => {
                  const isExpanded = expandedSalesId === s.id;
                  return (
                    <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300 mx-4`}>
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedSalesId(isExpanded ? null : s.id)}
                      >
                        <div className="flex flex-col gap-1 w-full max-w-[65%]">
                          <span className="font-bold text-sm text-[var(--accent)] truncate">{s.client?.name || 'Guest'}</span>
                          <span className="text-[10px] font-semibold text-[var(--muted)]">{new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-[var(--accent)] text-sm">â‚¹{parseFloat(s.total).toFixed(2)}</span>
                          <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Sale ID:</span>
                              <span className="font-mono font-bold text-[var(--muted)]">{s.saleId}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {totalSalesPages > 1 && (
              <div className="hidden lg:flex mt-6 items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Page {salesPage} of {totalSalesPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={salesPage === 1}
                    onClick={() => setSalesPage(prev => prev - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={salesPage === totalSalesPages}
                    onClick={() => setSalesPage(prev => prev + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Order Tracking Table */}
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-h3">Order Tracking</h3>
                <p className="text-xs text-[var(--muted)]">Filtered results: {filteredOrders.length}</p>
              </div>
              <button onClick={() => downloadCSV('orders')} className="flex items-center gap-2 rounded-xl bg-[var(--soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="erp-table-container hidden lg:block">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Order ID</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td><div className="skeleton h-5 w-20 rounded" /></td>
                        <td><div className="skeleton h-5 w-16 rounded" /></td>
                        <td><div className="skeleton h-5 w-32 rounded" /></td>
                        <td><div className="skeleton h-5 w-20 rounded-full" /></td>
                        <td className="text-right"><div className="skeleton h-5 w-16 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : paginatedOrders.map(o => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap text-xs text-[var(--muted)]">{formatDateDDMMYY(o.orderDate)}</td>
                      <td className="font-bold">#{o.id}</td>
                      <td>{o.product}</td>
                      <td>
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${o.status === 'Completed' ? 'bg-green-100 text-green-700' : o.status === 'Sold' ? 'bg-purple-100 text-purple-700' : o.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : o.status === 'Hold' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="text-right font-bold">{o.status === 'Sold' && saleOrderPrices[o.id] ? `â‚¹${saleOrderPrices[o.id]}` : o.price}</td>
                    </tr>
                  ))}
                  {paginatedOrders.length === 0 && !isDataLoading && (
                    <tr>
                      <td colSpan="5" className="text-center text-[var(--muted)]">No orders found for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="block lg:hidden mt-4 h-[50vh] -mx-4 px-4">
              <Virtuoso
                data={filteredOrders}
                overscan={200}
                itemContent={(index, o) => {
                  const isExpanded = expandedOrderId === o.id;
                  return (
                    <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300 mx-4`}>
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                      >
                        <div className="flex flex-col gap-1 w-full max-w-[65%]">
                          <span className="font-bold text-sm text-[var(--accent)] truncate">#{o.id} - {o.product}</span>
                          <span className="text-[10px] font-semibold text-[var(--muted)]">{formatDateDDMMYY(o.orderDate)}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${o.status === 'Completed' ? 'bg-green-100 text-green-700' : o.status === 'Sold' ? 'bg-purple-100 text-purple-700' : o.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : o.status === 'Hold' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                            {o.status}
                          </span>
                          <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Price:</span>
                              <span className="font-bold">{o.status === 'Sold' && saleOrderPrices[o.id] ? `â‚¹${saleOrderPrices[o.id]}` : o.price}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {totalOrdersPages > 1 && (
              <div className="hidden lg:flex mt-6 items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Page {ordersPage} of {totalOrdersPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={ordersPage === 1}
                    onClick={() => setOrdersPage(prev => prev - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={ordersPage === totalOrdersPages}
                    onClick={() => setOrdersPage(prev => prev + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Income Analysis Table */}
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-h3">Other Income</h3>
                <p className="text-xs text-[var(--muted)]">Filtered results: {filteredIncome.length}</p>
              </div>
              <button onClick={() => downloadCSV('income')} className="flex items-center gap-2 rounded-xl bg-[var(--soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="erp-table-container hidden lg:block">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td><div className="skeleton h-4 w-20 rounded" /></td>
                        <td><div className="skeleton h-5 w-24 rounded" /></td>
                        <td><div className="skeleton h-5 w-32 rounded" /></td>
                        <td className="text-right"><div className="skeleton h-6 w-20 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : paginatedIncome.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td className="font-mono font-bold text-[var(--muted)]">{s.category}</td>
                      <td className="font-medium">{s.reference || '-'}</td>
                      <td className="text-right font-black text-green-600">â‚¹{parseFloat(s.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {paginatedIncome.length === 0 && !isDataLoading && (
                    <tr>
                      <td colSpan="4" className="text-center text-[var(--muted)]">No income records found for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="block lg:hidden mt-4 h-[50vh] -mx-4 px-4">
              <Virtuoso
                data={filteredIncome}
                overscan={200}
                itemContent={(index, s) => {
                  const isExpanded = expandedIncomeId === s.id;
                  return (
                    <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300 mx-4`}>
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedIncomeId(isExpanded ? null : s.id)}
                      >
                        <div className="flex flex-col gap-1 w-full max-w-[65%]">
                          <span className="font-bold text-sm text-[var(--accent)] truncate">{s.category}</span>
                          <span className="text-[10px] font-semibold text-[var(--muted)]">{new Date(s.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-green-600 text-sm">â‚¹{parseFloat(s.amount).toFixed(2)}</span>
                          <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Reference:</span>
                              <span className="font-medium">{s.reference || '-'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {totalIncomePages > 1 && (
              <div className="hidden lg:flex mt-6 items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Page {incomePage} of {totalIncomePages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={incomePage === 1}
                    onClick={() => setIncomePage(prev => prev - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={incomePage === totalIncomePages}
                    onClick={() => setIncomePage(prev => prev + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Expense Analysis Table */}
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-h3">Other Expense</h3>
                <p className="text-xs text-[var(--muted)]">Filtered results: {filteredExpense.length}</p>
              </div>
              <button onClick={() => downloadCSV('expense')} className="flex items-center gap-2 rounded-xl bg-[var(--soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="erp-table-container hidden lg:block">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td><div className="skeleton h-4 w-20 rounded" /></td>
                        <td><div className="skeleton h-5 w-24 rounded" /></td>
                        <td><div className="skeleton h-5 w-32 rounded" /></td>
                        <td className="text-right"><div className="skeleton h-6 w-20 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : paginatedExpense.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td className="font-mono font-bold text-[var(--muted)]">{s.category}</td>
                      <td className="font-medium">{s.reference || '-'}</td>
                      <td className="text-right font-black text-red-600">â‚¹{parseFloat(s.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {paginatedExpense.length === 0 && !isDataLoading && (
                    <tr>
                      <td colSpan="4" className="text-center text-[var(--muted)]">No expense records found for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="block lg:hidden mt-4 h-[50vh] -mx-4 px-4">
              <Virtuoso
                data={filteredExpense}
                overscan={200}
                itemContent={(index, s) => {
                  const isExpanded = expandedExpenseId === s.id;
                  return (
                    <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300 mx-4`}>
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedExpenseId(isExpanded ? null : s.id)}
                      >
                        <div className="flex flex-col gap-1 w-full max-w-[65%]">
                          <span className="font-bold text-sm text-[var(--accent)] truncate">{s.category}</span>
                          <span className="text-[10px] font-semibold text-[var(--muted)]">{new Date(s.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-red-600 text-sm">â‚¹{parseFloat(s.amount).toFixed(2)}</span>
                          <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-semibold">Reference:</span>
                              <span className="font-medium">{s.reference || '-'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {totalExpensePages > 1 && (
              <div className="hidden lg:flex mt-6 items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Page {expensePage} of {totalExpensePages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={expensePage === 1}
                    onClick={() => setExpensePage(prev => prev - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={expensePage === totalExpensePages}
                    onClick={() => setExpensePage(prev => prev + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--soft)] disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
