export const generateReceiptHtmlString = (saleData) => {
  if (!saleData || !saleData.items) return '';

  const subtotal = saleData.items.reduce((s, i) => s + ((i.price || i.rate) * i.qty), 0);
  const totDisc = saleData.items.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
  const grandTotal = subtotal - totDisc;

  let itemsHtml = saleData.items.map(item => {
    const finalTotal = item.rowTotal !== undefined 
      ? item.rowTotal 
      : (item.qty * (item.price || item.rate)) * (1 - (item.discount || 0) / 100);
    
    const discDisplay = item.rowTotal !== undefined 
      ? `â‚¹${parseFloat(item.discount || 0).toFixed(0)}` 
      : `${item.discount || 0}%`;

    const productName = item.productName ? item.productName.replace(/\s*\(Order #[^)]+\)/g, '') : 'Item';

    return `
    <tr style="border-bottom: 1px dashed #e5e7eb;">
      <td style="padding: 8px 8px 8px 0;">
        <div style="font-weight: 700; font-size: 11px; margin-bottom: 2px;">${productName}</div>
        <div style="font-size: 10px; font-weight: 700; color: #6b7280;">Rate: â‚¹${item.price || item.rate}</div>
      </td>
      <td style="text-align: center; font-size: 10px; padding: 8px;">${item.qty}</td>
      <td style="text-align: right; font-size: 10px; padding: 8px; white-space: nowrap;">${discDisplay}</td>
      <td style="text-align: right; font-size: 10px; font-weight: 700; padding: 8px 0 8px 8px;">â‚¹${parseFloat(finalTotal).toFixed(2)}</td>
    </tr>
  `}).join('');

  const dateStr = new Date(saleData.timestamp).toDateString() === new Date().toDateString() 
    ? new Date(saleData.timestamp).toLocaleString() 
    : new Date(saleData.timestamp).toLocaleDateString();

  return `
    <div style="width: 80mm; padding: 5mm; color: #000; font-family: monospace; background: white; margin: 0 auto; box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 16px; border-bottom: 2px dashed #d1d5db; padding-bottom: 16px;">
        <img src="/logo-black.png" style="width: 100px; height: auto; margin: 0 auto 16px auto; display: block; object-fit: contain;" />
        <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.5px; line-height: 1;">Malka</h2>
        <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: 600;">Your Complete Destination For Timeless Style</p>
        <p style="margin: 2px 0 0 0; font-size: 12px;">Ph : 8606154015</p>
        <div style="margin-top: 8px; color: #6b7280; font-size: 10px;">
          <p style="margin: 2px 0;">Order ID: ${saleData.saleId}</p>
          <p style="margin: 2px 0;">${dateStr}</p>
        </div>
      </div>

      <div style="margin-bottom: 16px; font-size: 11px;">
        <p style="margin: 0; font-weight: 700;">Customer: ${saleData.client?.name || 'Guest'}</p>
        ${saleData.client?.phone ? `<p style="margin: 2px 0 0 0;">Tel: ${saleData.client.phone}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="border-bottom: 1px dashed #d1d5db; font-size: 10px; text-align: left;">
            <th style="padding: 4px 8px 4px 0; min-width: 80px;">Item</th>
            <th style="text-align: center; padding: 4px 8px;">Qty</th>
            <th style="text-align: right; padding: 4px 8px;">Disc (â‚¹/%)</th>
            <th style="text-align: right; padding: 4px 0 4px 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-top: 2px dashed #d1d5db; padding-top: 12px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
          <span>Grand Total</span>
          <span>â‚¹${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; font-size: 10px; border-top: 1px dashed #e5e7eb; padding-top: 16px; font-style: italic; color: #6b7280; line-height: 1.4;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #000;">Thank you for shopping!</p>
        <p style="margin: 0;">Your elegance is our priority.</p>
        <p style="margin: 0;">Please visit again for more unique designs.</p>
        <p style="margin: 8px 0 0 0; font-size: 9px;">This is a computer generated receipt.</p>
      </div>
    </div>
  `;
};
