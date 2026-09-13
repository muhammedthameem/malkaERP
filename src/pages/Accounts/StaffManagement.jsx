import React, { useState, useEffect, useRef } from 'react'
import { encryptId } from '../../utils/security'
import { Users, Pencil, Trash2, Search, Plus, Save, X, Download, FileText, ChevronUp, ChevronDown, UserPlus, CreditCard, Clock, AlertTriangle, Printer, FileDown, Upload, CheckCircle2, CalendarDays, RefreshCw } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import html2pdf from 'html2pdf.js'
import UndoToast from '../../components/UndoToast'
import supabase from '../../supabase'

function StaffManagementPage({ themeStyle, setCurrentPage, showGlobalToast, staffList = [], setStaffList, saveConfig, highlightStaffId, setHighlightStaffId, allAccounts = [] }) {
  const rowRefs = useRef({})
  const tableContainerRef = useRef(null);
  const [isSendingPdf, setIsSendingPdf] = useState(false);
  const [expandedMobileId, setExpandedMobileId] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    designation: '',
    phone: '',
    salary: '',
    salaryPerDay: '',
    balanceDue: '',
    overtimeType: 'Hourly',
    overtimeRate: '0'
  })

  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [tableMonthFilter, setTableMonthFilter] = useState(new Date().toISOString().slice(0, 7)) // Default to current month
  const [staffToDelete, setStaffToDelete] = useState(null)
  const [recentlyDeletedStaff, setRecentlyDeletedStaff] = useState(null)
  const undoTimeoutRef = useRef(null)
  const [ledgerStaff, setLedgerStaff] = useState(null)
  const [activeStaffForPdf, setActiveStaffForPdf] = useState(null)

  const formatNoteDates = (note) => {
    if (!note) return '';
    return note.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
  };

  const [payslipData, setPayslipData] = useState({
    type: 'Monthly', // or 'Custom'
    staffId: '',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    startDate: '',
    endDate: '',
    amount: '',
    overtime: '',
    selectedLogId: '',
    expectedAmount: '',
    daysWorked: ''
  })

  // Horizontal scroll for table via mouse wheel
  useEffect(() => {
    const handleWheel = (e) => {
      const container = tableContainerRef.current;
      if (!container) return;
      if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
        const isAtLeft = container.scrollLeft === 0 && e.deltaY < 0;
        const isAtRight = Math.abs(container.scrollWidth - container.clientWidth - container.scrollLeft) <= 1 && e.deltaY > 0;
        if (!isAtLeft && !isAtRight) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }
    };
    const elem = tableContainerRef.current;
    if (elem) {
      elem.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (elem) elem.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handlePayslipStaffChange = (e) => {
    const id = e.target.value;
    const staff = staffList.find(s => s.id === id);
    setPayslipData(prev => ({ ...prev, staffId: id, amount: '', overtime: '', selectedLogId: '', expectedAmount: '', daysWorked: '' }));
  }

  const handleLoggedPaymentSelect = (e) => {
    const accId = e.target.value;
    if (!accId) {
      setPayslipData(prev => ({ ...prev, amount: '', selectedLogId: '', overtime: '' }));
      return;
    }
    const acc = allAccounts.find(a => String(a.id) === accId);
    if (acc) {
      let type = 'Monthly';
      let startDate = '';
      let endDate = '';
      let month = acc.date ? acc.date.slice(0, 7) : '';

      if (acc.notes && acc.notes.includes('Weekly Payment:')) {
        const match = acc.notes.match(/Weekly Payment:\s*([\d-]+)\s*to\s*([\d-]+)/);
        if (match) {
          type = 'Custom';
          startDate = match[1];
          endDate = match[2];
        }
      }

      // Calculate overtime for this newly selected period
      const staff = staffList.find(s => s.id === payslipData.staffId);
      let overtimeSum = 0;
      if (staff) {
        const overtimeExpenses = allAccounts.filter(oAcc => {
          if (oAcc.type !== 'Expense' || oAcc.category !== 'Overtime Payment' || oAcc.reference !== `Overtime - ${staff.name}` || !oAcc.date) return false;
          if (type === 'Monthly') {
            return month && oAcc.date.startsWith(month);
          } else {
            let dateMatches = startDate && endDate && oAcc.date >= startDate && oAcc.date <= endDate;
            if (!dateMatches && oAcc.notes && startDate && endDate) {
              const match = oAcc.notes.match(/Weekly Payment:\s*([\d-]+)\s*to\s*([\d-]+)/);
              if (match && match[1] >= startDate && match[2] <= endDate) {
                dateMatches = true;
              }
            }
            return dateMatches;
          }
        });
        overtimeSum = overtimeExpenses.reduce((sum, oAcc) => sum + parseFloat(oAcc.amount || 0), 0);
      }

      setPayslipData(prev => ({
        ...prev,
        type,
        startDate,
        endDate,
        month,
        amount: acc.amount,
        selectedLogId: accId,
        overtime: overtimeSum > 0 ? overtimeSum : '',
        expectedAmount: ''
      }));
    }
  }

  // Calculate total overtime & salary logged for selected staff in selected period
  let monthlyOvertimeSum = 0;
  let monthlySalarySum = 0;
  if (payslipData.staffId && allAccounts.length > 0) {
    const staff = staffList.find(s => s.id === payslipData.staffId);
    if (staff) {
      const overtimeExpenses = allAccounts.filter(acc => {
        if (acc.type !== 'Expense' || acc.category !== 'Overtime Payment' || acc.reference !== `Overtime - ${staff.name}` || !acc.date) return false;
        let dateMatches = false;
        if (payslipData.type === 'Monthly') {
          dateMatches = payslipData.month && acc.date.startsWith(payslipData.month);
        } else {
          dateMatches = payslipData.startDate && payslipData.endDate && acc.date >= payslipData.startDate && acc.date <= payslipData.endDate;
          if (!dateMatches && acc.notes && payslipData.startDate && payslipData.endDate) {
            const match = acc.notes.match(/Weekly Payment:\s*([\d-]+)\s*to\s*([\d-]+)/);
            if (match && match[1] >= payslipData.startDate && match[2] <= payslipData.endDate) {
              dateMatches = true;
            }
          }
        }
        return dateMatches;
      });
      monthlyOvertimeSum = overtimeExpenses.reduce((sum, acc) => sum + parseFloat(acc.amount || 0), 0);

      const salaryExpenses = allAccounts.filter(acc => {
        if (acc.type !== 'Expense' || acc.reference !== `Salary - ${staff.name}` || !acc.date) return false;
        let dateMatches = false;
        if (payslipData.type === 'Monthly') {
          dateMatches = payslipData.month && acc.date.startsWith(payslipData.month);
        } else {
          dateMatches = payslipData.startDate && payslipData.endDate && acc.date >= payslipData.startDate && acc.date <= payslipData.endDate;
          if (!dateMatches && acc.notes && payslipData.startDate && payslipData.endDate) {
            const match = acc.notes.match(/Weekly Payment:\s*([\d-]+)\s*to\s*([\d-]+)/);
            if (match && match[1] >= payslipData.startDate && match[2] <= payslipData.endDate) {
              dateMatches = true;
            }
          }
        }
        return dateMatches;
      });
      monthlySalarySum = salaryExpenses.reduce((sum, acc) => sum + parseFloat(acc.amount || 0), 0);
    }
  }

  const handleDownloadPdf = () => {
    if (!payslipData.staffId) {
      if (showGlobalToast) showGlobalToast('Error', 'Please select a staff member.');
      return;
    }
    if (!payslipData.amount && !payslipData.overtime) {
      if (showGlobalToast) showGlobalToast('Error', 'No salary or overtime logged for this staff in the selected period. You must log the expense first to generate a payslip.');
      return;
    }
    const staff = staffList.find(s => s.id === payslipData.staffId);
    if (!staff) return;

    if (payslipData.type === 'Custom' && (!payslipData.startDate || !payslipData.endDate)) {
      if (showGlobalToast) showGlobalToast('Error', 'Please select both start and end dates.');
      return;
    }

    setActiveStaffForPdf({
      ...staff,
      payslipType: payslipData.type,
      payslipMonth: payslipData.month,
      payslipStartDate: payslipData.startDate,
      payslipEndDate: payslipData.endDate,
      payslipAmount: payslipData.amount,
      payslipOvertime: payslipData.overtime
    });
    
    setTimeout(async () => {
      try {
        const element = document.getElementById('payslip-template');
        if (!element) return;
        const opt = {
          margin: 0.2,
          filename: `Payslip_${staff.name.replace(/\s+/g, '_')}_${payslipData.month}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(element).save();
        setActiveStaffForPdf(null);
        if (showGlobalToast) showGlobalToast('Success', 'Payslip downloaded successfully.');

      } catch (error) {
        console.error("Payslip generation error:", error);
        if (showGlobalToast) showGlobalToast('Error', 'Failed to generate payslip.');
      }
    }, 500);
  }

  const handleSendWhatsApp = () => {
    if (!payslipData.staffId) {
      if (showGlobalToast) showGlobalToast('Error', 'Please select a staff member.');
      return;
    }
    if (!payslipData.amount && !payslipData.overtime) {
      if (showGlobalToast) showGlobalToast('Error', 'No salary or overtime logged for this staff in the selected period. You must log the expense first to generate a payslip.');
      return;
    }
    const staff = staffList.find(s => s.id === payslipData.staffId);
    if (!staff) return;

    if (payslipData.type === 'Custom' && (!payslipData.startDate || !payslipData.endDate)) {
      if (showGlobalToast) showGlobalToast('Error', 'Please select both start and end dates.');
      return;
    }

    setActiveStaffForPdf({
      ...staff,
      payslipType: payslipData.type,
      payslipMonth: payslipData.month,
      payslipStartDate: payslipData.startDate,
      payslipEndDate: payslipData.endDate,
      payslipAmount: payslipData.amount,
      payslipOvertime: payslipData.overtime
    });
    if (showGlobalToast) showGlobalToast('Generating', 'Uploading payslip to secure server...');
    setIsSendingPdf(true);
    setTimeout(async () => {
      try {
        const element = document.getElementById('payslip-template');
        if (!element) return;
        const opt = {
          margin: 0.2,
          filename: `Payslip_${staff.name.replace(/\s+/g, '_')}_${payslipData.month}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
        const fileName = `payslips/Payslip_${staff.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

        const { data, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        setActiveStaffForPdf(null);
        if (showGlobalToast) showGlobalToast('Success', 'Payslip uploaded successfully.');

        // Open WhatsApp
        const phone = staff.phone.replace(/\D/g, '');
        if (phone) {
          const appUrlObj = new URL('https://erp.malka.co.in');
          appUrlObj.searchParams.set('payslip', encryptId(fileName));
          const finalAppUrl = appUrlObj.toString();

          const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
          const periodStr = payslipData.type === 'Monthly'
            ? new Date(payslipData.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
            : `${payslipData.startDate.split('-').reverse().join('/')} to ${payslipData.endDate.split('-').reverse().join('/')}`;

          let text = `Hello *${staff.name}*,\n\n`;
          text += `Your payslip for *${periodStr}* has been generated.\n\n`;
          text += `Total Paid: *â‚¹${(parseFloat(payslipData.amount || 0) + parseFloat(payslipData.overtime || 0)).toLocaleString()}*\n\n`;
          text += `ðŸ“„ *View & Download Digital Payslip:*\n${finalAppUrl}\n\n`;
          text += `*Malka*`;

          window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
        } else {
          if (showGlobalToast) showGlobalToast('Warning', 'Payslip uploaded, but staff has no valid phone number for WhatsApp. Link: ' + finalAppUrl);
        }
      } catch (error) {
        console.error("Payslip generation error:", error);
        if (showGlobalToast) showGlobalToast('Error', 'Failed to generate or upload payslip.');
      } finally {
        setIsSendingPdf(false);
      }
    }, 500);
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.name || !formData.designation || !formData.phone || !formData.salary) {
      if (showGlobalToast) showGlobalToast('Error', 'Please fill all required fields.')
      return
    }

    let updatedList = [...staffList]

    if (isEditing) {
      updatedList = updatedList.map(s => s.id === formData.id ? { ...formData } : s)
      if (showGlobalToast) showGlobalToast('Success', 'Staff member updated.')
    } else {
      const newStaff = { ...formData, id: Date.now().toString() }
      updatedList.push(newStaff)
      if (showGlobalToast) showGlobalToast('Success', 'Staff member added.')
    }

    setStaffList(updatedList)
    if (saveConfig) saveConfig('staffList', updatedList)

    // Reset form
    setFormData({ id: '', name: '', designation: '', phone: '', salary: '', salaryPerDay: '', balanceDue: '', overtimeType: 'Hourly', overtimeRate: '0' })
    setIsEditing(false)
  }

  const handleEdit = (staff) => {
    setFormData({ ...staff })
    setIsEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id) => {
    const staff = staffList.find(s => s.id === id)
    if (staff) {
      setStaffToDelete(staff)
    }
  }

  const handleConfirmDelete = () => {
    if (!staffToDelete) return
    const id = staffToDelete.id

    const staff = { ...staffToDelete }
    setRecentlyDeletedStaff(staff)
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    undoTimeoutRef.current = setTimeout(() => {
      setRecentlyDeletedStaff(null)
    }, 8000)

    const updatedList = staffList.filter(s => s.id !== id)
    setStaffList(updatedList)
    if (saveConfig) saveConfig('staffList', updatedList)
    if (showGlobalToast) showGlobalToast('Deleted', `${staff.name} removed.`)
    if (isEditing && formData.id === id) {
      setFormData({ id: '', name: '', designation: '', phone: '', salary: '', salaryPerDay: '', balanceDue: '', overtimeType: 'Hourly', overtimeRate: '0' })
      setIsEditing(false)
    }
    setStaffToDelete(null)
  }

  const handleUndoDelete = () => {
    if (!recentlyDeletedStaff) return;
    const updatedList = [...staffList, recentlyDeletedStaff];
    setStaffList(updatedList);
    if (saveConfig) saveConfig('staffList', updatedList);
    if (showGlobalToast) showGlobalToast('Restored', `${recentlyDeletedStaff.name} has been restored.`);
    setRecentlyDeletedStaff(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }

  const cancelEdit = () => {
    setFormData({ id: '', name: '', designation: '', phone: '', salary: '', salaryPerDay: '', balanceDue: '', overtimeType: 'Hourly', overtimeRate: '0' })
    setIsEditing(false)
  }

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  )

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    if (sortConfig.key === 'name') {
      return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortConfig.key === 'designation') {
      return sortConfig.direction === 'asc' ? a.designation.localeCompare(b.designation) : b.designation.localeCompare(a.designation);
    }
    return 0;
  });

  const getDynamicTotalPaid = (staff) => {
    if (!allAccounts || allAccounts.length === 0) return 0;

    const payments = allAccounts.filter(acc => {
      if (acc.type !== 'Expense') return false;
      const isSalaryOrOvertime = acc.reference === `Salary - ${staff.name}` || acc.reference === `Overtime - ${staff.name}`;
      if (!isSalaryOrOvertime) return false;

      if (tableMonthFilter) {
        return acc.date && acc.date.startsWith(tableMonthFilter);
      }
      return true;
    });

    return payments.reduce((sum, acc) => sum + parseFloat(acc.amount || 0), 0);
  }

  const checkPaidStatus = (staff) => {
    if (!allAccounts || allAccounts.length === 0) return false;
    const monthToCheck = tableMonthFilter || new Date().toISOString().slice(0, 7);
    const payments = allAccounts.filter(acc => {
      if (acc.type !== 'Expense') return false;
      const isSalaryOrOvertime = acc.reference === `Salary - ${staff.name}` || acc.reference === `Overtime - ${staff.name}`;
      if (!isSalaryOrOvertime) return false;
      return acc.date && acc.date.startsWith(monthToCheck);
    });
    return payments.reduce((sum, acc) => sum + parseFloat(acc.amount || 0), 0) > 0;
  }

  useEffect(() => {
    if (highlightStaffId) {
      if (searchQuery !== '') setSearchQuery('');

      setTimeout(() => {
        const row = rowRefs.current[highlightStaffId] || rowRefs.current[String(highlightStaffId)] || rowRefs.current[Number(highlightStaffId)];
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            if (setHighlightStaffId) setHighlightStaffId(null);
          }, 3000);
        }
      }, 300);
    }
  }, [highlightStaffId, setHighlightStaffId]);

  return (
    <div style={themeStyle} className="relative">
      {/* Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-8 shadow-2xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Trash2 size={32} />
            </div>

            <h3 className="text-2xl font-bold text-[var(--text)]">Delete Staff?</h3>
            <p className="mt-3 text-[var(--muted)] leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-[var(--text)]">{staffToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3.5 font-bold transition hover:bg-[var(--soft)] cursor-pointer"
                onClick={() => setStaffToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-500 py-3.5 font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 cursor-pointer"
                onClick={handleConfirmDelete}
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Popup */}
      {recentlyDeletedStaff && (
        <UndoToast
          message="Deleted"
          highlight={recentlyDeletedStaff.name}
          onUndo={handleUndoDelete}
          onClose={() => { setRecentlyDeletedStaff(null); if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); }}
        />
      )}

      {/* Ledger Modal */}
      {ledgerStaff && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4 backdrop-blur-sm overflow-y-auto py-10">
          <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-[var(--text)]">Payment History</h3>
                <p className="mt-1 text-[var(--muted)] text-sm">Showing all salary and overtime records for <span className="font-bold text-[var(--text)]">{ledgerStaff.name}</span>.</p>
                {ledgerStaff.balanceDue && parseFloat(ledgerStaff.balanceDue) !== 0 && (
                  <p className="mt-3 text-sm font-bold text-red-600 bg-red-50 inline-block px-3 py-1 rounded-full border border-red-200">
                    Balance Payment Due: â‚¹{parseFloat(ledgerStaff.balanceDue).toLocaleString()}
                  </p>
                )}
              </div>
              <button onClick={() => setLedgerStaff(null)} className="rounded-full p-2 hover:bg-[var(--soft)] transition text-[var(--text)]">
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--soft)] z-10">
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-3 px-2 font-medium">Date</th>
                    <th className="py-3 px-2 font-medium">Category</th>
                    <th className="py-3 px-2 font-medium">Note</th>
                    <th className="py-3 px-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allAccounts.filter(acc => acc.type === 'Expense' && (acc.reference === `Salary - ${ledgerStaff.name}` || acc.reference === `Overtime - ${ledgerStaff.name}`))
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((acc, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--soft)] transition">
                        <td className="py-3 px-2 text-[var(--text)] whitespace-nowrap">
                          {acc.date ? `${String(new Date(acc.date).getDate()).padStart(2, '0')}/${String(new Date(acc.date).getMonth() + 1).padStart(2, '0')}/${new Date(acc.date).getFullYear()}` : '-'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${acc.category === 'Overtime Payment' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {acc.category === 'Overtime Payment' ? 'Overtime' : 'Salary'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[var(--muted)] text-xs leading-relaxed" style={{ wordBreak: 'break-word', whiteSpace: 'normal', minWidth: '200px' }}>
                          {formatNoteDates(acc.notes) || '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-green-600">â‚¹{parseFloat(acc.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  {allAccounts.filter(acc => acc.type === 'Expense' && (acc.reference === `Salary - ${ledgerStaff.name}` || acc.reference === `Overtime - ${ledgerStaff.name}`)).length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-[var(--muted)]">No payment history found for this staff.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Users size={32} className="text-[var(--accent)]" />
        <div>
          <h1 className="text-h1">Staff Payroll</h1>
          <p className="text-para text-[var(--muted)] mt-1">Manage studio staff, designations, and salaries</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-10">

        {/* Add / Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="h-full rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur flex flex-col">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
              {isEditing ? <><Pencil size={20} /> Edit Staff Member</> : <><Plus size={20} /> Add New Staff</>}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[var(--text)]">Full Name <span className="text-red-500">*</span></span>
                <input
                  name="name"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Jane Doe"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--text)]">Designation <span className="text-red-500">*</span></span>
                <input
                  name="designation"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                  type="text"
                  value={formData.designation}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Master Tailor"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--text)]">Phone Number <span className="text-red-500">*</span></span>
                <input
                  name="phone"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., +91 9876543210"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--text)]">Salary (â‚¹) <span className="text-red-500">*</span></span>
                <input
                  name="salary"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                  type="number"
                  min="0"
                  value={formData.salary}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 5000"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--text)]">Salary Per Day (â‚¹) <span className="text-[11px] text-[var(--muted)]">- Optional</span></span>
                <input
                  name="salaryPerDay"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                  type="number"
                  min="0"
                  value={formData.salaryPerDay || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., 1000"
                />
              </label>
            </div>

            <div className="mt-auto pt-6 flex justify-end gap-3">
              {isEditing && (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-6 py-3 font-semibold transition hover:bg-[var(--soft)] cursor-pointer"
                  onClick={cancelEdit}
                >
                  <X size={18} /> Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3.5 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:bg-[var(--accent)]/90 cursor-pointer"
              >
                <Save size={18} /> {isEditing ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </section>
        </form>

        {/* Generate Payslip Card */}
        <section className="h-full rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur flex flex-col">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Download size={20} className="text-[var(--accent)]" /> Generate Monthly Payslip
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 items-start">
            <label className="block">
              <span className="text-sm font-medium text-[var(--text)]">Payslip Type</span>
              <select
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                value={payslipData.type}
                onChange={e => setPayslipData(prev => ({ ...prev, type: e.target.value, overtime: '' }))}
              >
                <option value="Monthly">Monthly</option>
                <option value="Custom">Weekly / Custom Period</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text)]">Select Staff</span>
              <select
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                value={payslipData.staffId}
                onChange={handlePayslipStaffChange}
              >
                <option value="">-- Select Staff --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>)}
              </select>
            </label>

            {payslipData.staffId && (() => {
              const staff = staffList.find(s => s.id === payslipData.staffId);
              const staffSalaryLogs = staff ? allAccounts.filter(acc => acc.type === 'Expense' && acc.reference === `Salary - ${staff.name}`) : [];

              return (
                <>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-[var(--text)]">Current Pending Balance (â‚¹)</span>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none opacity-80"
                      value={staff && staff.balanceDue ? `â‚¹${parseFloat(staff.balanceDue).toLocaleString()}` : 'â‚¹0'}
                      readOnly
                    />
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="text-sm font-medium text-[var(--text)]">Amount Paid (â‚¹) <span className="text-red-500">*</span></span>
                    <select
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                      value={payslipData.selectedLogId || ""}
                      onChange={handleLoggedPaymentSelect}
                      disabled={!payslipData.staffId}
                    >
                      <option value="">-- Select logged payment --</option>
                      {staffSalaryLogs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(acc => (
                        <option key={acc.id} value={acc.id}>
                          â‚¹{acc.amount} - {new Date(acc.date).toLocaleDateString()} {acc.notes ? `(${acc.notes.substring(0, 30)}${acc.notes.length > 30 ? '...' : ''})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              );
            })()}

            {payslipData.selectedLogId && (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--text)]">Payslip Type</span>
                  <input
                    type="text"
                    readOnly
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none opacity-80"
                    value={payslipData.type}
                  />
                </label>
                {payslipData.type === 'Monthly' ? (
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--text)]">Payslip Month</span>
                    <input
                      type="month"
                      readOnly
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none opacity-80"
                      value={payslipData.month}
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--text)]">Start Date</span>
                      <input
                        type="date"
                        readOnly
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none opacity-80"
                        value={payslipData.startDate}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--text)]">End Date</span>
                      <input
                        type="date"
                        readOnly
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none opacity-80"
                        value={payslipData.endDate}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            <label className="block">
              <span className="text-sm font-medium text-[var(--text)]">Overtime (â‚¹) <span className="text-[11px] text-[var(--muted)]">- Optional</span></span>
              <select
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                value={payslipData.overtime}
                onChange={e => setPayslipData(prev => ({ ...prev, overtime: e.target.value }))}
                disabled={!payslipData.staffId}
              >
                <option value="">0 (No Overtime)</option>
                {monthlyOvertimeSum > 0 && (
                  <option value={monthlyOvertimeSum}>â‚¹{monthlyOvertimeSum} (Logged Overtime)</option>
                )}
              </select>
            </label>
          </div>
          <div className="mt-auto pt-6 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-6 py-3.5 font-bold text-[var(--text)] transition hover:bg-[var(--soft)] cursor-pointer ${(!payslipData.staffId || isSendingPdf) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleDownloadPdf}
              disabled={!payslipData.staffId || isSendingPdf}
            >
              <Download size={18} /> Download PDF
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3.5 font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:bg-[var(--accent)]/90 cursor-pointer ${(!payslipData.staffId || isSendingPdf) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleSendWhatsApp}
              disabled={!payslipData.staffId || isSendingPdf}
            >
              <FileText size={18} /> {isSendingPdf ? 'Generating...' : 'Send WhatsApp Link'}
            </button>
          </div>
        </section>

      </div>

      {/* Search & Filter Card */}
      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md flex-1">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--muted)] shadow-sm focus-within:border-[var(--accent)] transition-colors">
              <Search size={18} />
              <input
                className="w-full bg-transparent outline-none placeholder:text-stone-400 font-medium text-[var(--text)]"
                placeholder="Search staff..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="month"
                className="h-11 w-full sm:w-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                value={tableMonthFilter}
                onChange={(e) => setTableMonthFilter(e.target.value)}
                title="Filter Total Paid by Month"
              />
              <button
                onClick={() => setTableMonthFilter('')}
                className={`h-11 whitespace-nowrap rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition ${!tableMonthFilter ? 'bg-[var(--accent)] text-white shadow-md' : 'bg-[var(--surface-strong)] hover:bg-[var(--soft)] text-[var(--text)]'}`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur overflow-hidden">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 shrink-0"><Users size={20} /> Added Staff ({staffList.length})</h2>
        </div>

        <div className="erp-table-container hidden lg:block" ref={tableContainerRef}>
          <table className="erp-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="cursor-pointer select-none hover:text-[var(--text)] transition group">
                  <div className="flex items-center gap-1">
                    Name
                    <span className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
                      {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-50" />}
                    </span>
                  </div>
                </th>
                <th onClick={() => handleSort('designation')} className="cursor-pointer select-none hover:text-[var(--text)] transition group">
                  <div className="flex items-center gap-1">
                    Designation
                    <span className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
                      {sortConfig.key === 'designation' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-50" />}
                    </span>
                  </div>
                </th>
                <th>Phone</th>
                <th>Salary (Monthly)</th>
                <th>Salary / Day</th>
                <th>Balance Payment Due</th>
                <th>Total Paid (â‚¹)</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaff.length > 0 ? (
                sortedStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    ref={el => rowRefs.current[staff.id] = el}
                    className={`group transition-all duration-1000 ${highlightStaffId === staff.id ? 'bg-[var(--accent-soft)]/50 ring-2 ring-[var(--accent)] ring-inset' : 'hover:bg-[var(--soft)]'}`}
                  >
                    <td className="font-semibold text-[var(--text)]">{staff.name}</td>
                    <td>
                      <span className="rounded bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--accent)]">
                        {staff.designation}
                      </span>
                    </td>
                    <td className="text-[var(--text)]">{staff.phone}</td>
                    <td className="font-semibold text-[var(--text)]">â‚¹{parseFloat(staff.salary || 0).toLocaleString()}</td>
                    <td className="font-semibold text-[var(--text)]">{staff.salaryPerDay ? `â‚¹${parseFloat(staff.salaryPerDay).toLocaleString()}` : '-'}</td>
                    <td className="font-bold text-red-500">{staff.balanceDue && parseFloat(staff.balanceDue) !== 0 ? `â‚¹${parseFloat(staff.balanceDue).toLocaleString()}` : '-'}</td>
                    <td className="font-bold">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-green-600">â‚¹{getDynamicTotalPaid(staff).toLocaleString()}</span>
                        {checkPaidStatus(staff) ? (
                          <span className="w-fit rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Paid {tableMonthFilter ? '' : '(This Month)'}</span>
                        ) : (
                          <span className="w-fit rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Unpaid {tableMonthFilter ? '' : '(This Month)'}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                          title="View Payment History"
                          onClick={() => setLedgerStaff(staff)}
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                          title="Edit"
                          onClick={() => handleEdit(staff)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white"
                          title="Delete"
                          onClick={() => handleDelete(staff.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-[var(--muted)]">
                    {searchQuery ? "No staff found matching search criteria." : "No staff members added yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="block lg:hidden mt-4 h-[65vh] -mx-4 px-4">
          <Virtuoso
            data={sortedStaff}
            overscan={200}
            itemContent={(index, staff) => {
              const isExpanded = expandedMobileId === staff.id;
              return (
                <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300`}>
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedMobileId(isExpanded ? null : staff.id)}
                  >
                    <div className="flex flex-col gap-1 w-full max-w-[65%]">
                      <span className="font-bold text-sm text-[var(--text)] truncate">{staff.name}</span>
                      <span className="text-[11px] font-semibold text-[var(--muted)]">{staff.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="rounded bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--accent)]">{staff.designation}</span>
                      <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="pt-3 border-t border-[var(--border)] mb-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--muted)] font-semibold">Monthly Salary:</span>
                          <span className="font-medium text-[var(--text)]">â‚¹{parseFloat(staff.salary || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--muted)] font-semibold">Salary / Day:</span>
                          <span className="font-medium text-[var(--text)]">{staff.salaryPerDay ? `â‚¹${parseFloat(staff.salaryPerDay).toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--muted)] font-semibold">Balance Due:</span>
                          <span className="font-bold text-red-500">{staff.balanceDue && parseFloat(staff.balanceDue) !== 0 ? `â‚¹${parseFloat(staff.balanceDue).toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--muted)] font-semibold">Total Paid:</span>
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-green-600 font-bold">â‚¹{getDynamicTotalPaid(staff).toLocaleString()}</span>
                            {checkPaidStatus(staff) ? (
                              <span className="w-fit rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Paid {tableMonthFilter ? '' : '(This Month)'}</span>
                            ) : (
                              <span className="w-fit rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Unpaid {tableMonthFilter ? '' : '(This Month)'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs hover:bg-[var(--accent)] hover:text-white transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLedgerStaff(staff)
                          }}
                        >
                          <FileText size={16} /> Ledger
                        </button>
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(staff)
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(staff.id)
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </section>


      {/* Hidden Payslip Template for PDF Generation */}
      {activeStaffForPdf && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id="payslip-template" style={{ width: '700px', padding: '40px', boxSizing: 'border-box', background: '#fff', color: '#000', fontFamily: 'sans-serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '20px', marginBottom: '30px' }}>
              <img src="/logo-black.png" alt="Logo" style={{ width: '112px', height: '128px', margin: '0 auto 16px auto', objectFit: 'contain', display: 'block' }} />
              <h3 style={{ textTransform: 'uppercase', letterSpacing: '-0.025em', fontSize: '24px', fontWeight: '800', margin: '0', color: '#111' }}>Malka</h3>
              <p style={{ fontSize: '12px', fontWeight: '500', margin: '4px 0 2px' }}>Be Unique, Be Malka</p>
              <p style={{ margin: '2px 0', fontSize: '12px' }}>Ph : 8606154015</p>
              <p style={{ margin: '16px 0 0', color: '#444', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>Official Payslip Record</p>
            </div>

            <table style={{ width: '100%', marginBottom: '40px', fontSize: '16px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', width: '25%' }}>Staff Name:</td>
                  <td style={{ padding: '8px 0', width: '25%' }}>{activeStaffForPdf.name}</td>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', width: '25%' }}>Date Issued:</td>
                  <td style={{ padding: '8px 0', width: '25%' }}>{new Date().toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Designation:</td>
                  <td style={{ padding: '8px 0' }}>{activeStaffForPdf.designation}</td>
                  <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Payslip Period:</td>
                  <td style={{ padding: '8px 0' }}>
                    {activeStaffForPdf.payslipType === 'Monthly'
                      ? new Date(activeStaffForPdf.payslipMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
                      : `${activeStaffForPdf.payslipStartDate.split('-').reverse().join('/')} to ${activeStaffForPdf.payslipEndDate.split('-').reverse().join('/')}`}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', width: '60%' }}>Description</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', width: '40%' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px 20px' }}>Basic Salary</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold' }}>â‚¹{parseFloat(activeStaffForPdf.salary || 0).toLocaleString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px 20px' }}>Salary Paid for {activeStaffForPdf.payslipType === 'Monthly' ? new Date(activeStaffForPdf.payslipMonth + '-01').toLocaleString('default', { month: 'long' }) : 'Selected Period'}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold' }}>â‚¹{parseFloat(activeStaffForPdf.payslipAmount || 0).toLocaleString()}</td>
                  </tr>
                  {parseFloat(activeStaffForPdf.payslipOvertime || 0) > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '16px 20px' }}>Overtime Pay</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold' }}>â‚¹{parseFloat(activeStaffForPdf.payslipOvertime || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px 20px' }}>Total Pending Balance</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(activeStaffForPdf.balanceDue || 0) > 0 ? 'red' : 'green' }}>
                      â‚¹{parseFloat(activeStaffForPdf.balanceDue || 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee', background: '#f8f9fa' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', fontSize: '18px' }}>Total Gross Pay</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold', color: 'green', fontSize: '18px' }}>
                      â‚¹{(parseFloat(activeStaffForPdf.payslipAmount || 0) + parseFloat(activeStaffForPdf.payslipOvertime || 0)).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
              <div style={{ textAlign: 'center' }}>
                <img src="/sign-removebg-preview.png" alt="Signature" style={{ height: '60px', objectFit: 'contain', display: 'block', margin: '0 auto -5px auto', position: 'relative', zIndex: 1 }} />
                <p style={{ marginTop: '0', borderTop: '1px solid #000', paddingTop: '10px', width: '200px', fontWeight: 'bold', position: 'relative', zIndex: 2 }}>Employer Signature</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '10px', width: '200px', fontWeight: 'bold' }}>Employee Signature</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffManagementPage
