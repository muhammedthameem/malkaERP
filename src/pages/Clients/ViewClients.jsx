import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, UsersRound, Eye, Pencil, Trash2, Download, Plus, ChevronDown } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import html2pdf from 'html2pdf.js'
import { formatDateDDMMYY } from '../../utils/constants'

import supabase from '../../supabase'
import UndoToast from '../../components/UndoToast'

function ViewClientsPage({ themeStyle, setCurrentPage, setSelectedClient, setClientDetailMode, showGlobalToast, currentUser, highlightClientId, setHighlightClientId, clients, setClients, deleteClient, cloudLoaded }) {
  const rowRefs = useRef({})
  const [searchQuery, setSearchQuery] = useState('')
  const [clientToDelete, setClientToDelete] = useState(null)
  const [recentlyDeletedClient, setRecentlyDeletedClient] = useState(null)
  const undoTimeoutRef = useRef(null)
  const [expandedMobileId, setExpandedMobileId] = useState(null)
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const itemsPerPage = 10

  const isDataLoading = !cloudLoaded && (!clients || clients.length === 0);

  const displayClients = (clients || []).filter(c => !recentlyDeletedClient || String(c.id) !== String(recentlyDeletedClient.id));

  const filteredClients = useMemo(() => {
    return displayClients.filter(client =>
      (client.name?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.mobile?.toString() || '').includes(searchQuery) ||
      (client.address?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.clientProduct?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery]);

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [filteredClients]);
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage)

  useEffect(() => {
    if (totalPages > 0 && currentPageNum > totalPages) {
      setCurrentPageNum(totalPages)
    }
  }, [totalPages, currentPageNum])

  useEffect(() => {
    if (highlightClientId) {
      if (searchQuery !== '') setSearchQuery('');

      setTimeout(() => {
        const currentDisplay = (clients || []).filter(c => !recentlyDeletedClient || String(c.id) !== String(recentlyDeletedClient.id));
        const currentSorted = [...currentDisplay].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const index = currentSorted.findIndex(c => String(c.id) === String(highlightClientId));
        if (index !== -1) {
          const page = Math.floor(index / itemsPerPage) + 1;
          setCurrentPageNum(page);

          setTimeout(() => {
            const row = rowRefs.current[highlightClientId] || rowRefs.current[String(highlightClientId)] || rowRefs.current[Number(highlightClientId)];
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => {
                if (setHighlightClientId) setHighlightClientId(null);
              }, 3000);
            }
          }, 500);
        }
      }, 100);
    }
  }, [highlightClientId, clients, recentlyDeletedClient, itemsPerPage, setHighlightClientId]);

  useEffect(() => {
    setCurrentPageNum(1);
  }, [searchQuery]);

  const paginatedClients = sortedClients.slice((currentPageNum - 1) * itemsPerPage, currentPageNum * itemsPerPage)

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    const idToDelete = clientToDelete.id;
    const client = { ...clientToDelete };

    setRecentlyDeletedClient(client);
    const updatedClients = clients.filter(c => String(c.id) !== String(idToDelete));
    setClients(updatedClients);
    setClientToDelete(null);
    if (showGlobalToast) showGlobalToast('Client Deleted', `Client "${client.name}" removed.`);

    undoTimeoutRef.current = setTimeout(() => {
      setRecentlyDeletedClient(null);
    }, 8000);

    try {
      if (deleteClient) {
        await deleteClient(idToDelete);
      } else {
        await supabase.from('erp_clients').delete().eq('id', idToDelete);
      }
    } catch (err) {
      console.error("Cloud delete failed:", err);
    }
  };

  const handleUndoDelete = async () => {
    if (!recentlyDeletedClient) return;

    const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === "" ? undefined : v));
    await supabase.from('erp_clients').upsert([{ id: recentlyDeletedClient.id.toString(), data: clean(recentlyDeletedClient) }]);

    setClients(prev => prev.some(c => String(c.id) === String(recentlyDeletedClient.id)) ? prev : [...prev, recentlyDeletedClient]);
    if (showGlobalToast) showGlobalToast('Restored', `Client "${recentlyDeletedClient.name}" has been restored.`);
    setRecentlyDeletedClient(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }

  const downloadClientPdf = (client) => {
    if (showGlobalToast) showGlobalToast('Generating PDF...', 'Please wait while we prepare the document.')

    const container = document.createElement('div')
    container.style.padding = '40px'
    container.style.fontFamily = '"Inter", system-ui, -apple-system, sans-serif'
    container.style.color = '#1f2937'
    container.style.maxWidth = '800px'
    container.style.margin = '0 auto'

    let html = `
      <div style="border-bottom: 2px solid #8e4431; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="/logo-black.png" style="width: 56px; height: 60px; object-fit: contain;" />
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #8e4431; margin: 0; letter-spacing: -0.5px;">MALKA</h1>
            <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Be Unique, Be Malka</p>
            <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Client Measurement Record</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0;">${client.name}</h2>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">Generated: ${formatDateDDMMYY(new Date().toISOString())}</p>
        </div>
      </div>
      
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
        <h3 style="font-size: 14px; color: #8e4431; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Personal Information</h3>
        <div style="display: flex; gap: 40px;">
          <div>
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Mobile Number</p>
            <p style="margin: 0; font-size: 14px; font-weight: 500;">${client.mobile || 'N/A'}</p>
          </div>
          <div>
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Client Since</p>
            <p style="margin: 0; font-size: 14px; font-weight: 500;">${formatDateDDMMYY(client.createdAt)}</p>
          </div>
          <div style="flex: 1;">
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Address</p>
            <p style="margin: 0; font-size: 14px; font-weight: 500;">${client.address || 'N/A'}</p>
          </div>
        </div>
      </div>
    `

    const measurementsList = client.measurements?.length > 0 ? client.measurements : []
    if (measurementsList.length === 0 && client.product) {
      measurementsList.push({
        product: client.product,
        topMeasurements: client.topMeasurements || {},
        bottomMeasurements: client.bottomMeasurements || {},
        note: client.note
      })
    }

    if (measurementsList.length > 0) {
      measurementsList.forEach((m, idx) => {
        html += `
          <div style="margin-bottom: 24px;">
            <div style="margin-bottom: 20px;">
              <span style="font-size: 18px; font-weight: 800; color: #8e4431; margin-right: 8px;">${idx + 1}.</span><span style="font-size: 18px; color: #111827; font-weight: 600;">${m.product || 'Unspecified Product'}</span>
            </div>
        `

        const renderTable = (title, measurementsObj, fields) => {
          if (!measurementsObj || !Object.keys(measurementsObj).some(k => measurementsObj[k])) return ''

          let tableHtml = `
            <div style="margin-bottom: 20px;">
              <h4 style="font-size: 12px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr>
                    <th style="padding: 10px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600; width: 40%;">Property</th>
                    <th style="padding: 10px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600; width: 30%;">Length</th>
                    <th style="padding: 10px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600; width: 30%;">Round</th>
                  </tr>
                </thead>
                <tbody>
          `

          let hasRows = false;
          let rowIndex = 0;

          if (measurementsObj.length) {
            hasRows = true;
            tableHtml += `<tr style="background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #111827;">Product Length</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #4b5563;">${measurementsObj.length}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #9ca3af;">-</td>
            </tr>`
            rowIndex++;
          }

          fields.forEach(f => {
            const l = measurementsObj[`${f.key}Length`]
            const r = measurementsObj[`${f.key}Round`]
            if (l || r) {
              hasRows = true;
              tableHtml += `<tr style="background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #111827;">${f.label}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #4b5563;">${l || '<span style="color:#d1d5db">-</span>'}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #4b5563;">${r || '<span style="color:#d1d5db">-</span>'}</td>
              </tr>`
              rowIndex++;
            }
          })

          tableHtml += `</tbody></table></div>`
          return hasRows ? tableHtml : ''
        }

        const topFields = [
          { key: 'upChest', label: 'Up-Chest' }, { key: 'chest', label: 'Chest' }, { key: 'bust', label: 'Bust' },
          { key: 'waist', label: 'Waist' }, { key: 'hip', label: 'Hip' }, { key: 'shoulder', label: 'Shoulder' },
          { key: 'front', label: 'Front' }, { key: 'back', label: 'Back' }, { key: 'neckF', label: 'Neck F' },
          { key: 'neckB', label: 'Neck B' }, { key: 'halfSleeves', label: 'Half Sleeves' }, { key: 'fullSleeves', label: 'Full Sleeves' },
          { key: 'threeQuarterSleeves', label: '3/4 Sleeves' }, { key: 'elbow', label: 'Elbow' }
        ]
        html += renderTable('Top Measurements', m.topMeasurements, topFields)

        const bottomFields = [
          { key: 'waist', label: 'Waist' }, { key: 'hip', label: 'Hip' }, { key: 'thighs', label: 'Thighs' },
          { key: 'knee', label: 'Knee' }, { key: 'calf', label: 'Calf' }, { key: 'ankle', label: 'Ankle' },
          { key: 'crotch', label: 'Crotch' }
        ]
        html += renderTable('Bottom Measurements', m.bottomMeasurements, bottomFields)

        if (m.note) {
          html += `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 10px;">
            <p style="margin: 0; font-size: 11px; color: #b45309; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Special Notes</p>
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.4;">${m.note}</p>
          </div>`
        }

        html += `</div>`
      })
    } else {
      html += `<p style="font-style: italic; color: #6b7280;">No measurements recorded yet.</p>`
    }

    container.innerHTML = html

    // Measure actual content height to avoid blank second page
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.width = '794px' // A4 width at 96dpi
    document.body.appendChild(container)
    const contentHeightPx = container.getBoundingClientRect().height
    document.body.removeChild(container)
    container.style.position = ''
    container.style.left = ''
    container.style.width = ''

    // Convert px to mm (1px = 0.264583mm) and add margin buffer
    const pageHeightMm = Math.ceil(contentHeightPx * 0.264583) + 20

    const opt = {
      margin: 10,
      filename: `Client_${client.name.replace(/\s+/g, '_')}_Details.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: [210, pageHeightMm], orientation: 'portrait' }
    }

    html2pdf().set(opt).from(container).save()
    if (showGlobalToast) showGlobalToast('Downloaded!', `PDF for "${client.name}" is ready.`)
  }

  return (
    <div style={themeStyle}>

      {/* Undo Popup */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)] mb-1">
            <UsersRound size={16} /> CRM Database
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-h1">View Clients</h1>
            <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-sm font-bold text-[var(--text)] border border-[var(--border)]">{displayClients ? displayClients.length : 0} Total</span>
          </div>
          <p className="text-para text-[var(--muted)] mt-2">Manage and search all client records</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md flex-1">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--muted)] shadow-sm focus-within:border-[var(--accent)] transition-colors">
              <Search size={18} />
              <input
                className="w-full bg-transparent outline-none placeholder:text-stone-400 font-medium"
                placeholder="Search clients..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto">
            <button
              className="flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-95 active:scale-95 whitespace-nowrap"
              onClick={() => setCurrentPage('add-clients')}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add New Client</span>
              <span className="sm:hidden">Add Client</span>
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
        <div className="erp-table-container hidden lg:block">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Product</th>
                <th>Address</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isDataLoading ? (
                // Skeleton Table Rows
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton h-5 w-32 rounded" /></td>
                    <td><div className="skeleton h-5 w-24 rounded" /></td>
                    <td><div className="skeleton h-5 w-40 rounded" /></td>
                    <td><div className="skeleton h-5 w-48 rounded" /></td>
                    <td><div className="skeleton h-5 w-20 rounded" /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <div className="skeleton h-10 w-10 rounded-xl" />
                        <div className="skeleton h-10 w-10 rounded-xl" />
                        <div className="skeleton h-10 w-10 rounded-xl" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <tr
                    key={client.id || client.mobile}
                    ref={el => rowRefs.current[client.id] = el}
                    className={`group transition-all duration-1000 ${highlightClientId === client.id ? 'bg-[var(--accent-soft)]/50 ring-2 ring-[var(--accent)] ring-inset' : ''}`}
                  >
                    <td>
                      <span className="font-semibold text-[var(--text)]">{client.name}</span>
                    </td>
                    <td>{client.mobile}</td>
                    <td>
                      <div className="max-w-[200px] truncate text-sm font-medium text-[var(--muted)]">
                        {client.measurements?.length > 0
                          ? [...new Set(client.measurements.map(m => m.product))].join(', ')
                          : (client.product || '-')}
                      </div>
                    </td>
                    <td>{client.address}</td>
                    <td>{formatDateDDMMYY(client.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white shadow-sm active:scale-95"
                          title="View Profile"
                          onClick={() => {
                            setSelectedClient(client)
                            if (setClientDetailMode) setClientDetailMode('view')
                            setCurrentPage('client-detail')
                          }}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white shadow-sm active:scale-95 opacity-80"
                          title="Add Measurement"
                          onClick={() => {
                            setSelectedClient(client)
                            if (setClientDetailMode) setClientDetailMode('view')
                            setCurrentPage('client-detail')
                            localStorage.setItem('triggerAddMeasurement', 'true')
                          }}
                        >
                          <Plus size={18} />
                        </button>
                        {currentUser?.role === 'Admin' && (
                          <button
                            className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white shadow-sm active:scale-95"
                            title="Delete Client"
                            onClick={() => setClientToDelete(client)}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        <button
                          className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--soft)] text-[var(--muted)] transition hover:bg-[var(--accent)] hover:text-white shadow-sm active:scale-95"
                          title="Download PDF"
                          onClick={() => downloadClientPdf(client)}
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                    No clients found matching "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="block lg:hidden mt-4 h-[65vh] -mx-4 px-4">
          <Virtuoso
            data={sortedClients}
            overscan={200}
            itemContent={(index, client) => {
              const isExpanded = expandedMobileId === client.id;
              return (
                <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300`}>
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedMobileId(isExpanded ? null : client.id)}
                  >
                    <div className="flex flex-col gap-1 w-full max-w-[65%]">
                      <span className="font-bold text-sm text-[var(--accent)] truncate">{client.name}</span>
                      <span className="text-[11px] font-semibold text-[var(--text)]">{client.mobile}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="pt-3 border-t border-[var(--border)] mb-4 flex flex-col gap-2">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="text-[var(--muted)] font-semibold">Address:</span>
                          <span className="font-medium text-[var(--text)]">{client.address || '-'}</span>
                        </div>
                        <div className="flex flex-col gap-1 text-xs mt-1">
                          <span className="text-[var(--muted)] font-semibold">Products/Measurements:</span>
                          <div className="max-w-full flex flex-wrap gap-1">
                            {client.measurements?.length > 0 ? (
                               [...new Set(client.measurements.map(m => m.product))].map((prod, idx) => (
                                   <span key={idx} className="bg-[var(--soft)] px-1.5 py-0.5 rounded text-[10px] text-[var(--muted)]">{prod}</span>
                               ))
                            ) : (
                                <span className="bg-[var(--soft)] px-1.5 py-0.5 rounded text-[10px] text-[var(--muted)]">{client.product || '-'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs hover:bg-[var(--accent)] hover:text-white transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client)
                            if (setClientDetailMode) setClientDetailMode('view')
                            setCurrentPage('client-detail')
                          }}
                        >
                          <Eye size={16} /> View Profile
                        </button>
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client)
                            if (setClientDetailMode) setClientDetailMode('view')
                            setCurrentPage('client-detail')
                            localStorage.setItem('triggerAddMeasurement', 'true')
                          }}
                        >
                          <Plus size={16} />
                        </button>
                        {currentUser?.role === 'Admin' && (
                          <button
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientToDelete(client);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>

        {totalPages > 1 && (
          <div className="hidden lg:flex mt-4 items-center justify-between border-t border-[var(--border)] pt-4">
            <span className="text-sm text-[var(--muted)]">Showing {(currentPageNum - 1) * itemsPerPage + 1} to {Math.min(currentPageNum * itemsPerPage, filteredClients.length)} of {filteredClients.length}</span>
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

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-500/10 text-red-500">
              <Trash2 size={32} />
            </div>
            <h3 className="mb-2 text-xl font-bold text-[var(--text)]">Delete Client?</h3>
            <p className="mb-6 text-sm text-[var(--muted)]">
              Are you sure you want to delete <strong className="text-[var(--text)]">{clientToDelete.name}</strong>? This action will permanently remove their records.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-3 font-semibold transition hover:bg-[var(--soft)]"
                onClick={() => setClientToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 active:scale-95"
                onClick={handleDeleteConfirm}
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {recentlyDeletedClient && (
        <UndoToast
          message="Deleted Client"
          highlight={recentlyDeletedClient.name}
          onUndo={handleUndoDelete}
          onClose={() => { setRecentlyDeletedClient(null); if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); }}
        />
      )}
    </div>
  )
}

export default ViewClientsPage;
