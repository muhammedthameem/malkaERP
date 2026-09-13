import React, { useEffect, useState } from 'react';
import supabase from '../supabase';
import { CheckCircle, Download, Package } from 'lucide-react';
import html2pdf from 'html2pdf.js'
import { generateReceiptHtmlString } from '../utils/pdfHelper';
import { formatDateDDMMYY } from '../utils/constants';

function PublicReceipt({ billId, onClear }) {
  const [sale, setSale] = useState(null);
  const [isOrder, setIsOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const cleanId = billId ? billId.trim() : '';
        if (!cleanId) {
          setLoading(false);
          return;
        }

        // Strategy 1: match data->>'saleId' (PostgREST JSON operator)
        let { data, error } = await supabase
          .from('erp_sales')
          .select('*')
          .eq('data->>saleId', cleanId)
          .maybeSingle();

        // Strategy 2: match top-level id column as text
        if (!data) {
          const res2 = await supabase
            .from('erp_sales')
            .select('*')
            .eq('id', cleanId)
            .maybeSingle();
          if (res2.data) data = res2.data;
        }

        // Strategy 3: fetch recent sales and scan in JS (most reliable fallback)
        if (!data) {
          const res3 = await supabase
            .from('erp_sales')
            .select('*')
            .order('id', { ascending: false })
            .limit(500);
          if (res3.data) {
            const found = res3.data.find(row => {
              const sale = row.data || row;
              return sale.saleId === cleanId || String(row.id) === cleanId;
            });
            if (found) data = found;
          }
        }

        if (data) {
          setSale(data.data || data);
          setIsOrder(false);
          setLoading(false);
          return;
        }

        // If no sale found, try erp_orders
        let orderRes = await supabase
          .from('erp_orders')
          .select('*')
          .eq('id', cleanId)
          .maybeSingle();

        if (!orderRes.data) {
          const orderRes2 = await supabase
            .from('erp_orders')
            .select('*')
            .order('id', { ascending: false })
            .limit(500);
          if (orderRes2.data) {
            const foundOrder = orderRes2.data.find(row => {
              const order = row.data || row;
              return String(order.id) === cleanId || String(row.id) === cleanId;
            });
            if (foundOrder) orderRes.data = foundOrder;
          }
        }

        if (orderRes.data) {
          setSale(orderRes.data.data || orderRes.data);
          setIsOrder(true);
        }

      } catch (error) {
        console.error("Error fetching sale/order:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [billId]);

  const handleDownload = async () => {
    const element = document.getElementById(isOrder ? 'receipt-content' : 'printable-bill');
    if (!element || isGenerating) return;

    try {
      setIsGenerating(true);

      if (isOrder) {
        const clone = element.cloneNode(true);
        clone.style.display = 'block';
        clone.style.width = '800px';
        const htmlString = clone.outerHTML;

        const opt = {
          margin: [10, 0, 10, 0],
          filename: `Receipt_Order_${sale.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(htmlString).save().then(() => setIsGenerating(false));
      } else {
        const opt = {
          margin: 0,
          filename: `Receipt_${sale.saleId}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: [97, 200], orientation: 'portrait' }
        };

        const htmlString = generateReceiptHtmlString(sale);
        const container = document.createElement('div');
        container.innerHTML = htmlString;

        html2pdf().set(opt).from(container.outerHTML).output('blob').then((pdfBlob) => {
          const blobUrl = URL.createObjectURL(pdfBlob);

          // 1. Auto-download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `Receipt_${sale.saleId}.pdf`;
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

          setIsGenerating(false);
        }).catch(err => {
          console.error('PDF Error:', err);
          alert("Could not generate PDF on this device. Please take a screenshot of the receipt instead.");
          setIsGenerating(false);
        });
      }
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Could not generate PDF on this device. Please take a screenshot of the receipt instead.");
      setIsGenerating(false);
    } finally {
      if (!isOrder) {
        // Clean up any potential html2pdf overlays for thermal receipts
        setTimeout(() => {
          const overlays = document.querySelectorAll('.html2pdf__overlay, .html2pdf__container');
          overlays.forEach(o => o.remove());
        }, 500);
      }
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f7f2ec]">
      <div className="text-center">
        <div className="h-12 w-12 border-4 border-[#8B4513] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Loading Receipt...</p>
      </div>
    </div>
  );

  if (!sale) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f2ec] p-6">
        <div className="text-center max-w-sm">
          <div className="h-20 w-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/10">
            <Package size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2">Receipt Not Found</h2>
          <p className="text-stone-500 text-sm mb-6 leading-relaxed">
            We couldn't load this receipt. It may not have synced to the cloud yet, or the link may be invalid.
          </p>
          <p className="text-stone-400 text-xs mb-8 leading-relaxed">
            Please contact the boutique with your bill ID: <span className="font-bold text-stone-700">{billId}</span>
          </p>
          <button
            onClick={() => {
              if (onClear) onClear();
              window.history.replaceState({}, '', '/');
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#8B4513] text-white rounded-2xl font-bold text-sm shadow-xl hover:brightness-110 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f2ec] p-4 lg:p-10 flex flex-col items-center">
      <div className="w-full max-w-lg mb-8 text-center">
        <div className="flex items-center justify-center gap-2 text-[#8B4513] mb-2">
          <CheckCircle size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Digital Receipt</span>
        </div>
        <h1 className="text-3xl font-black mb-2 text-stone-900">Malka</h1>
        <p className="text-stone-500 text-sm">Thank you for your {isOrder ? 'order' : 'purchase'}!</p>

        {isOrder && (
          <button onClick={handleDownload} disabled={isGenerating} className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-[#8B4513] text-white rounded-xl font-bold text-sm shadow-md hover:brightness-110 transition disabled:opacity-50">
            <Download size={16} /> {isGenerating ? 'Generating...' : 'Download Receipt'}
          </button>
        )}
      </div>

      {isOrder ? (
        <div className="w-full overflow-x-auto pb-8 flex justify-center">
          <div id="receipt-content" style={{ display: 'block' }} className="shadow-2xl rounded-lg overflow-hidden shrink-0">
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
                  <p style={{ margin: '8px 0 0 0', fontSize: '15px', color: '#4b5563', fontWeight: '600' }}>Order #{sale.id}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>Date: {sale.orderDate ? formatDateDDMMYY(sale.orderDate) : 'N/A'}</p>
                </div>
              </div>

              {/* Client & Delivery Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px', fontWeight: '600' }}>Billed To:</h3>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '20px', color: '#111827' }}>{sale.clientName}</p>
                </div>
                <div style={{ flex: 1, paddingLeft: '20px', borderLeft: '2px solid #f3f4f6' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px', fontWeight: '600' }}>Delivery Information:</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#4b5563' }}>Expected Delivery: <span style={{ fontWeight: '600', color: '#111827' }}>{sale.deliveryDate ? formatDateDDMMYY(sale.deliveryDate) : 'N/A'}</span></p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '15px', color: '#4b5563' }}>Material Source: <span style={{ fontWeight: '600', color: '#111827' }}>{sale.sourceOfMaterial || 'Outside'}</span></p>
                </div>
              </div>

              {/* Order Details Table */}
              <div style={{ marginBottom: '40px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 15px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '14px', fontWeight: '600', borderRadius: '8px 0 0 8px' }}>Description</th>
                      <th style={{ padding: '12px 15px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '14px', fontWeight: '600' }}>Type</th>
                      <th style={{ padding: '12px 15px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '12px 15px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '14px', fontWeight: '600', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f3f4f6', fontSize: '16px', fontWeight: '600', color: '#111827' }}>{sale.product}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f3f4f6', fontSize: '15px', color: '#4b5563' }}>{sale.orderType || '-'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f3f4f6', fontSize: '15px', color: '#4b5563', textAlign: 'center' }}>{sale.size || '1'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f3f4f6', fontSize: '16px', fontWeight: '600', color: '#111827', textAlign: 'right' }}>â‚¹{parseFloat(sale.price || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '50px' }}>
                <div style={{ width: '380px', backgroundColor: '#f9fafb', padding: '25px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px' }}>
                    <span style={{ color: '#4b5563' }}>Subtotal:</span>
                    <span style={{ fontWeight: '600', color: '#111827' }}>â‚¹{parseFloat(sale.price || 0).toFixed(2)}</span>
                  </div>
                  {sale.advance > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px' }}>
                      <span style={{ color: '#4b5563' }}>Advance Paid:</span>
                      <span style={{ fontWeight: '600', color: '#059669' }}>- â‚¹{parseFloat(sale.advance || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '2px dashed #d1d5db', fontSize: '22px' }}>
                    <span style={{ fontWeight: '800', color: '#111827' }}>Balance Due:</span>
                    <span style={{ fontWeight: '800', color: '#111827' }}>â‚¹{(parseFloat(sale.price || 0) - parseFloat(sale.advance || 0)).toFixed(2)}</span>
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
      ) : (

        <div id="printable-bill" className="mb-8 bg-white p-4 text-black shadow-inner overflow-hidden mx-auto" style={{ width: '97mm', minHeight: '120mm', fontFamily: 'monospace' }}>
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
            <img src="/logo-black.png" alt="Logo" className="w-28 h-32 mx-auto mb-4 object-contain" />
            <h3 className="uppercase tracking-tight !text-[24px] !font-extrabold">Malka</h3>
            <p className="text-[10px] font-medium">Be Unique, Be Malka</p>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>Ph : 8606154015</p>
            <div className="mt-2 text-gray-500">
              <p className='!text-[10px]'>Order ID: {sale.saleId}</p>
              <p className='!text-[10px]'>{new Date(sale.timestamp).toDateString() === new Date().toDateString() ? new Date(sale.timestamp).toLocaleString() : new Date(sale.timestamp).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-4 text-[11px]">
            <p className="font-bold">Customer: {sale.client?.name || 'Guest'}</p>
            {sale.client?.phone && <p>Tel: {sale.client.phone}</p>}
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
              {(sale.items || []).map((item, idx) => {
                const rowTotal = item.rowTotal !== undefined
                  ? item.rowTotal
                  : (item.qty * (item.price || item.rate)) * (1 - (item.discount || 0) / 100);

                return (
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
                    <td className="py-2 text-right pl-3 font-bold">â‚¹{parseFloat(rowTotal).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1">
            <div className="flex justify-between text-sm font-black">
              <span>Grand Total</span>
              <span>â‚¹{((sale.items || []).reduce((s, i) => s + ((i.price || i.rate) * i.qty), 0) - (sale.items?.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0) || 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center mt-6 text-[10px] text-gray-500 italic border-t border-dashed border-gray-200 pt-4">
            <p className="font-bold text-black mb-1">Thank you for shopping!</p>
            <p>Your elegance is our priority.</p>
            <p>Please visit again for more unique designs.</p>
            <p className="mt-2 text-[9px]">This is a computer generated receipt.</p>
          </div>
        </div>
      )}

      <p className="mt-8 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        Powered by Malka ERP
      </p>
    </div>
  );
}

export default PublicReceipt;


