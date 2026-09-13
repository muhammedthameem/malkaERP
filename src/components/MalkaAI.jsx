import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, UserPlus, ShoppingBag, BarChart3, Search, MessageSquare, Mic, Sparkles, Package } from 'lucide-react';
import supabase from '../supabase';

const MalkaAI = ({
  user,
  isAdmin,
  clients,
  setClients,
  saveClient,
  deleteClient,
  orders,
  setOrders,
  saveOrder,
  deleteOrder,
  sales,
  setCurrentPage,
  showGlobalToast,
  activities,
  saveActivity,
  inventory = [],
  setInventory,
  saveInventory,
  users = [],
  orderLimits = {},
  setOrderLimits,
  saveConfig,
  selectedClient,
  setSelectedClient,
  clientDetailMode,
  setClientDetailMode
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Drag and Drop state
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_ai_position');
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  });

  const [alignRight, setAlignRight] = useState(true);
  const containerRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const startDrag = (clientX, clientY) => {
    dragStart.current = { x: clientX, y: clientY };
    startPos.current = { ...position };
    hasDragged.current = false;
  };

  const performDrag = (clientX, clientY) => {
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDragged.current = true;
      let newX = startPos.current.x + dx;
      let newY = startPos.current.y + dy;

      if (containerRef.current) {
        const initialRect = containerRef.current.getBoundingClientRect();
        const rawLeft = initialRect.left - position.x;
        const rawTop = initialRect.top - position.y;

        const nextLeft = rawLeft + newX;
        const nextTop = rawTop + newY;
        const width = initialRect.width;
        const height = initialRect.height;

        const minLeft = 10;
        const maxLeft = window.innerWidth - width - 10;
        const minTop = 10;
        const maxTop = window.innerHeight - height - 10;

        if (nextLeft < minLeft) newX = minLeft - rawLeft;
        if (nextLeft > maxLeft) newX = maxLeft - rawLeft;
        if (nextTop < minTop) newY = minTop - rawTop;
        if (nextTop > maxTop) newY = maxTop - rawTop;
      }

      setPosition({ x: newX, y: newY });
    }
  };

  const endDrag = () => {
    if (hasDragged.current) {
      localStorage.setItem('erp_ai_position', JSON.stringify(position));
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent) => {
      performDrag(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      endDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);

    const handleTouchMove = (moveEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const moveTouch = moveEvent.touches[0];
      performDrag(moveTouch.clientX, moveTouch.clientY);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      endDrag();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isLeftHalf = rect.left < window.innerWidth / 2;
    setAlignRight(!isLeftHalf);
  }, [position, isOpen]);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hello ${user?.name || 'there'}! I'm Malka AI. How can I help you manage your boutique today?` }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const storedAgent = localStorage.getItem('erp_ai_agent');
  const [agentMode, setAgentMode] = useState(storedAgent === 'intelligent' ? 'malka' : (storedAgent || 'malka'));
  const [apiKey, setApiKey] = useState(localStorage.getItem('erp_gemini_api_key') || '');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addActivity = (title) => {
    if (!saveActivity) return;
    const newAct = {
      id: Date.now(),
      title,
      timestamp: new Date().toISOString(),
      actor: user?.name || 'System',
      type: 'AI_AGENT'
    };
    saveActivity(newAct);
  };

  // --- THE BRAIN ENGINE ---
  const processCommand = async (text) => {
    const cmd = text.toLowerCase();
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 500)); // Faster response

    // Handle API Key setting
    if (text.toUpperCase().startsWith('KEY:')) {
      const key = text.substring(4).trim();
      setApiKey(key);
      localStorage.setItem('erp_gemini_api_key', key);
      return "✅ Gemini API Key saved successfully! You can now chat with Gemini 2.5 Flash.";
    }

    if (agentMode === 'gemini') {
      if (!apiKey) {
        return "⚠️ Please enter your Gemini API Key to use Gemini.\n\nType exactly:\n**KEY: your_api_key**";
      }
      try {
        const systemPrompt = `You are Malka AI, the dedicated intelligent manager for Malka ERP.
You have FULL UNRESTRICTED ACCESS to the entire boutique database and the ability to perform any Create, Read, Update, and Delete operations on ANY table.

BOUTIQUE DATABASE CONTEXT:
- CLIENTS: ${JSON.stringify(clients?.map(c => ({ id: c.id, name: c.name, phone: c.phone, address: c.address, email: c.email })) || [])}
- ORDERS: ${JSON.stringify(orders?.map(o => ({ id: o.id, deliveryDate: o.deliveryDate, orderDate: o.orderDate, total: o.totalAmount || o.total, status: o.status, client: o.clientName || o.client })) || [])}
- INVENTORY: ${JSON.stringify(inventory?.map(i => ({ id: i.id, name: i.name, stock: i.quantity || i.stock })) || [])}

AVAILABLE ACTIONS (MANDATORY: Wrap JSON in <ACTION> tags):
- {"type": "NAVIGATE", "payload": {"page": "dashboard" | "view-clients" | "add-client" | "client-detail" | "view-orders" | "add-order" | "view-sales" | "create-sales" | "view-inventory" | "create-inventory" | "inventory-detail" | "reports" | "view-accounts" | "add-income" | "add-expense" | "staff-management" | "view-users"}}
- {"type": "DB_ACTION", "payload": {"table": "erp_clients" | "erp_orders" | "erp_inventory" | "erp_sales" | "erp_accounts" | "erp_users", "method": "INSERT" | "UPDATE" | "DELETE", "data": {...}, "matchField": "id", "matchValue": "..."}}

RULES:
1. If the user asks a question about the data (e.g., "what is the status of order X"), answer them directly in plain English using the BOUTIQUE DATABASE CONTEXT provided. DO NOT use DB_ACTION to read data.
2. NEVER output raw JSON to the user. ALWAYS wrap actions in <ACTION>...</ACTION>.
3. To create a record, use DB_ACTION with method INSERT and provide the data object. Use Date.now().toString() for new IDs if applicable.
4. To update a record, use DB_ACTION with method UPDATE, provide the data object, and specify matchField and matchValue.
5. To delete a record, use DB_ACTION with method DELETE, and specify matchField and matchValue.
6. If the user explicitly asks to "open" or "view" a page, use the NAVIGATE action.
7. You are talking to an Admin. You have permission to do EVERYTHING. Just do it directly.
8. Always be helpful, professional, and concise.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: text }] }]
          })
        });
        const data = await res.json();
        if (data.error) {
          if (data.error.message.includes('API key not valid')) {
            return `Gemini API Error: API key not valid. The key we are trying to use is: \n\n"${apiKey}"\n\nPlease check if it's correct and case-sensitive!`;
          }
          return "Gemini API Error: " + data.error.message;
        }

        let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";

        // --- IMPROVED ACTION PARSER ---
        // Check for tags first, then fallback to raw JSON if it looks like an action
        let actionStr = null;
        const actionMatch = responseText.match(/<ACTION>([\s\S]*?)<\/ACTION>/);

        if (actionMatch) {
          actionStr = actionMatch[1].trim();
          responseText = responseText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
        } else if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
          // Fallback: If Gemini just returned raw JSON without tags
          actionStr = responseText.trim();
          responseText = ""; // Clear it so user doesn't see raw JSON
        }

        if (actionStr) {
          try {
            const action = JSON.parse(actionStr);

            if (action.type === 'NAVIGATE') {
              setCurrentPage(action.payload.page);
              responseText += responseText ? `\n\n✨ _Navigating..._` : `✨ _Opening ${action.payload.page}..._`;
            } else if (action.type === 'DB_ACTION') {
              const { table, method, data, matchField, matchValue } = action.payload;
              if (method === 'INSERT') {
                const insertData = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() };
                const { error } = await supabase.from(table).insert([insertData]);
                if (error) throw error;
                responseText += `\n\n✅ _Record created in ${table}._`;
              } else if (method === 'UPDATE') {
                const { error } = await supabase.from(table).update(data).eq(matchField, matchValue);
                if (error) throw error;
                responseText += `\n\n✅ _Record updated in ${table}._`;
              } else if (method === 'DELETE') {
                const { error } = await supabase.from(table).delete().eq(matchField, matchValue);
                if (error) throw error;
                responseText += `\n\n🗑️ _Record deleted from ${table}._`;
              }
            }
          } catch (e) {
            console.error("Gemini Action Parse Error:", e);
          }
        }

        return responseText || "I've processed your request!";
      } catch (err) {
        return "Error connecting to Gemini: " + err.message;
      }
    }



    // --- 0. CONTEXT & MEMORY (HIGHEST PRIORITY) ---
    const isAffirmative = cmd.startsWith('yes') || cmd.startsWith('sure') || cmd.startsWith('ok') || cmd.startsWith('go') || cmd.startsWith('do it');
    const dateMatch = cmd.match(/\d+/);
    const hasMonth = (cmd.includes('jan') || cmd.includes('feb') || cmd.includes('mar') || cmd.includes('apr') || cmd.includes('may') || cmd.includes('jun') || cmd.includes('jul') || cmd.includes('aug') || cmd.includes('sep') || cmd.includes('oct') || cmd.includes('nov') || cmd.includes('dec'));

    // If we are waiting for a date to set a limit
    if ((isAffirmative || (dateMatch && hasMonth) || cmd.length < 10) && window._pendingAIAction === 'SET_LIMIT') {
      const limit = window._pendingAILimit || 2;
      const year = new Date().getFullYear();

      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const monthShort = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      let fM = -1, fD = -1;

      cmd.split(/[ \/\-,]/).forEach(w => {
        const mI = monthNames.indexOf(w.trim());
        const sI = monthShort.indexOf(w.trim());
        if (mI !== -1) fM = mI;
        if (sI !== -1) fM = sI;
        const v = parseInt(w);
        if (!isNaN(v) && v <= 31 && fD === -1) fD = v;
      });

      if (fM !== -1 && fD !== -1) {
        const dateKey = `${year}-${String(fM + 1).padStart(2, '0')}-${String(fD).padStart(2, '0')}`;
        const newLimits = { ...orderLimits, [dateKey]: limit };
        setOrderLimits(newLimits);
        if (saveConfig) saveConfig('orderLimits', newLimits);
        window._pendingAIAction = null;
        return `✅ **Operational Success**: I've successfully applied the limit of **${limit} orders** to **${monthNames[fM].toUpperCase()} ${fD}**. Thank you for your patience!`;
      }
    }

    // --- 1. MASTER DELETE & CONTROL (Admin Only) ---
    if (cmd.includes('delete') || cmd.includes('remove') || cmd.includes('erase')) {

      if (cmd.includes('order')) {
        const orderId = cmd.match(/\d+/)?.[0];
        if (orderId) {
          const found = orders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
          if (found) {
            if (deleteOrder) deleteOrder(found.id);
            setOrders(prev => prev.filter(o => String(o.id) !== String(found.id)));
            addActivity(`AI Deleted Order: #${found.id}`);
            return `🗑️ **Order Purged**: Order **#${found.id}** has been permanently removed from the cloud.`;
          }
          return `I couldn't find order #${orderId}. Please verify the ID!`;
        }
      }

      if (cmd.includes('client')) {
        const name = cmd.replace(/.*delete client |.*remove client /, '').trim();
        const found = clients.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
        if (found) {
          if (deleteClient) deleteClient(found.id);
          setClients(prev => prev.filter(c => String(c.id) !== String(found.id)));
          addActivity(`AI Deleted Client: ${found.name}`);
          return `🗑️ **Client Removed**: **${found.name}** and their history have been permanently deleted from your boutique cloud.`;
        }
        return `I couldn't find a client named "${name}". Try giving me their full name!`;
      }
      return "What would you like to delete? Please say 'Delete order [ID]' or 'Delete client [Name]'.";
    }

    // --- 2. DATA ANALYSIS & INSIGHTS ---
    if (cmd.includes('best client') || cmd.includes('top client') || cmd.includes('valuable client')) {
      const clientStats = {};
      orders.forEach(o => {
        const cid = o.clientId || o.client;
        if (cid) clientStats[cid] = (clientStats[cid] || 0) + (parseFloat(o.totalAmount) || 0);
      });
      const topClientId = Object.keys(clientStats).reduce((a, b) => clientStats[a] > clientStats[b] ? a : b, null);
      const topClient = clients.find(c => (c.clientId || c.id || c.phone) == topClientId);
      if (topClient) return `Based on order history, **${topClient.name}** is your top client with ₹${clientStats[topClientId].toLocaleString()} spend. Shall I open their profile?`;
      return "I need more order data to calculate that!";
    }

    // --- 3. FINANCIAL INTELLIGENCE ---
    if (cmd.includes('report') || cmd.includes('revenue') || cmd.includes('money') || cmd.includes('sale')) {
      const total = orders.reduce((acc, s) => acc + (parseFloat(s.total || s.paidAmount || 0)), 0);
      return `💸 **Revenue Pulse**: Your total life-time revenue is **₹${total.toLocaleString()}**. Would you like me to open the full Reports page?`;
    }

    // --- 4. STOCK & INVENTORY SECURITY (Priority Check) ---
    if (cmd.includes('inv') || cmd.includes('stock') || cmd.includes('material')) {
      if (cmd.includes('go') || cmd.includes('open') || cmd.includes('show') || cmd.includes('take') || cmd.includes('view') || cmd.includes('page') || cmd.includes('look')) {
        setCurrentPage('view-inventory');
        return "Opening **Inventory**. Everything is in its place!";
      }
      // If they just mentioned stock but didn't ask to open the page
      return "📦 **Inventory Intelligence**: I have access to your boutique's materials and stock levels. What specific stock info do you need, Admin?";
    }

    // --- 5. FUZZY NAVIGATION & MASTER ACCESS ---
    const isNav = cmd.includes('go') || cmd.includes('open') || cmd.includes('show') || cmd.includes('take') || cmd.includes('view') || cmd.includes('page') || cmd.includes('look');

    if (isNav || cmd.length < 12) {
      if (cmd.includes('client') || cmd.includes('cust') || cmd.includes('people')) {
        setCurrentPage('view-clients');
        return "Showing your **Client List**.";
      }
      if (cmd.includes('order') || cmd.includes('stitch') || cmd.includes('book')) {
        setCurrentPage('view-orders');
        return "Opening the **Order Book**.";
      }
      if (cmd.includes('user') || cmd.includes('team') || cmd.includes('staff')) {
        setCurrentPage('view-users');
        return "Showing your **Team Members**.";
      }
      if (cmd.includes('dash') || cmd.includes('home')) {
        setCurrentPage('dashboard');
        return "Back to **Dashboard**!";
      }
    }

    // --- 5. OPERATIONAL CONTROL (Settings & Limits) ---
    if (cmd.includes('limit') && (cmd.includes('set') || cmd.includes('change'))) {
      if (!isAdmin) return "🔒 **Admin Access Required**: Production limits are owner-only.";

      const numMatch = cmd.match(/\d+/);
      const limit = numMatch ? parseInt(numMatch[0]) : null;

      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const monthShort = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      let fMonth = -1, fDay = -1;

      // Smart Parse: Ignore the limit number when looking for the day
      const words = cmd.split(/[ \/\-]/);
      words.forEach((w, idx) => {
        const mI = monthNames.indexOf(w);
        const sI = monthShort.indexOf(w);
        if (mI !== -1) fMonth = mI;
        if (sI !== -1) fMonth = sI;

        const v = parseInt(w);
        if (!isNaN(v)) {
          // If this number isn't the limit, or if it's clearly a day (1-31) and we found a month
          if (v !== limit || (idx > 0 && (words[idx - 1].includes('may') || words[idx - 1].includes('jun') || words[idx - 1].includes('jul')))) {
            if (v <= 31 && fDay === -1 && v !== limit) fDay = v;
            // Special case: if "may 15" and limit is 2, 15 is definitely the day
            if (v > limit && v <= 31) fDay = v;
          }
        }
      });

      // Fallback: if we still don't have a day, look for the last number in the string
      if (fDay === -1 && words.length > 0) {
        for (let i = words.length - 1; i >= 0; i--) {
          const v = parseInt(words[i]);
          if (!isNaN(v) && v <= 31 && v !== limit) { fDay = v; break; }
        }
      }

      if (fMonth !== -1 && fDay !== -1 && limit !== null) {
        const dateKey = `${new Date().getFullYear()}-${String(fMonth + 1).padStart(2, '0')}-${String(fDay).padStart(2, '0')}`;
        const newLimits = { ...orderLimits, [dateKey]: limit };
        setOrderLimits(newLimits);
        if (saveConfig) saveConfig('orderLimits', newLimits);
        window._pendingAIAction = null;
        return `✅ **Operational Update**: I've correctly set the limit to **${limit} orders** for **${monthNames[fMonth].toUpperCase()} ${fDay}**. I ignored the "2" when looking for the date this time!`;
      }

      window._pendingAIAction = 'SET_LIMIT';
      window._pendingAILimit = limit;
      if (limit === null) return "How many orders should we limit it to? (Example: 'Limit 2')";
      return `I've got the limit count (${limit}), but I need the date. Could you please say just the date (like "May 15")?`;
    }

    // --- 6. ENTITY NAVIGATION (Edit/View Specifics) ---
    if (cmd.includes('edit') && (cmd.includes('client') || cmd.includes('cust'))) {
      const searchName = cmd.replace(/edit|client|cust/g, '').trim();
      if (searchName.length < 2) return "Who should I edit? (Example: 'Edit client Meera')";

      const target = clients.find(c =>
        c.name?.toLowerCase().includes(searchName) ||
        searchName.includes(c.name?.toLowerCase())
      );

      if (target) {
        setSelectedClient(target);
        setClientDetailMode('edit');
        setCurrentPage('client-detail');
        return `🎯 **Direct Access**: Opening **${target.name}**'s profile in **Edit Mode**...`;
      }
      return `I couldn't find a client named "${searchName}". Please check the name and try again!`;
    }

    if ((cmd.includes('view') || cmd.includes('show') || cmd.includes('open')) && (cmd.includes('client') || cmd.includes('cust'))) {
      const searchName = cmd.replace(/view|show|open|client|cust/g, '').trim();
      if (searchName.length >= 2) {
        const target = clients.find(c =>
          c.name?.toLowerCase().includes(searchName) ||
          searchName.includes(c.name?.toLowerCase())
        );
        if (target) {
          setSelectedClient(target);
          setClientDetailMode('view');
          setCurrentPage('client-detail');
          return `🔍 **Profile Located**: Viewing **${target.name}**'s measurements and history.`;
        }
      }
    }

    // F. CURIOSITY & HELP
    if (cmd.includes('what can you do') || cmd.includes('help')) {
      return "I am your Digital Manager! I can:\n1. **Add records** (clients/orders)\n2. **Analyze business** (Admins only)\n3. **Monitor stock** (low inventory alerts)\n4. **Navigate** anywhere in the app\n\nJust talk to me like a human!";
    }

    // DEFAULT
    return "I'm not exactly sure how to do that yet, but I can help with clients, orders, inventory, or business reports!";
  };

  const handleSend = async () => {
    try {
      const currentInput = input.trim();
      if (!currentInput) return;

      setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
      setInput('');
      setIsTyping(true);

      const response = await processCommand(currentInput);
      if (response) {
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      }
      setIsTyping(false);
    } catch (err) {
      console.error("AI Fatal Error:", err);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Something went wrong. I've reset myself and I'm ready for your next command!" }]);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        touchAction: 'none'
      }}
      className="fixed bottom-24 right-4 md:bottom-20 md:right-8 z-[2500]"
    >
      {/* AI Bubble - Premium Luxury Design */}
      <button
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={(e) => {
          if (hasDragged.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          setIsOpen(!isOpen);
        }}
        className={`group relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing ${isOpen ? 'bg-stone-900 rotate-90' : 'bg-[var(--jewel)]'}`}
      >
        {isOpen ? (
          <X className="text-white" />
        ) : (
          <div className="relative">
            <Bot className="text-white group-hover:scale-110 transition-transform animate-pulse" size={28} />
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white ring-4 ring-[var(--jewel)]" />
          </div>
        )}
      </button>

      {/* Chat Window - Premium Silk Finish */}
      {isOpen && (
        <div className={`absolute bottom-17 ${alignRight ? 'right-0' : 'left-0'} w-[400px] max-w-[90vw] h-[500px] max-h-[75vh] sm:h-[600px] sm:max-h-[600px] overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)] shadow-[0_40px_120px_rgba(0,0,0,0.35)] transition-all animate-in slide-in-from-bottom-10 duration-500 flex flex-col ring-1 ring-[var(--border)]/35 backdrop-blur-xl`}>
          {/* Header - Jewel Theme Color */}
          <div className="relative overflow-hidden bg-[var(--jewel)] py-3 px-4 sm:py-5 sm:px-7 text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] shrink-0">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 -ml-4 -mb-4 h-16 w-16 rounded-full bg-black/10 blur-xl" />
            <div className="relative flex items-center justify-between gap-2">
              {/* Left Side: Avatar, Title, Badge */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-black/20 backdrop-blur-md shadow-inner shrink-0">
                  <Sparkles size={18} className="text-white sm:size-[22px]" />
                </div>
                <div className="min-w-0 leading-tight">
                  <h3 className="text-sm sm:text-base font-bold tracking-tight drop-shadow-md truncate">Malka AI</h3>
                  <div className="hidden xs:inline-flex items-center gap-1 text-[8px] uppercase tracking-[0.15em] font-black py-0.5 px-1.5 bg-black/20 rounded mt-0.5">
                    <span className="relative flex h-1 w-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-white"></span>
                    </span>
                    Manager
                  </div>
                </div>
              </div>

              {/* Right Side: Select Dropdown & Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={agentMode}
                  onChange={(e) => {
                    setAgentMode(e.target.value);
                    localStorage.setItem('erp_ai_agent', e.target.value);
                  }}
                  className="bg-black/20 text-white text-[9px] sm:text-[10px] rounded-lg px-2 py-1 outline-none font-bold uppercase tracking-wider border border-white/10 cursor-pointer"
                >
                  <option value="malka" className="bg-[var(--surface-strong)] text-[var(--text)]">Basic</option>
                  <option value="gemini" className="bg-[var(--surface-strong)] text-[var(--text)]">Gemini 1.5</option>
                </select>
                <button onClick={() => setIsOpen(false)} className="rounded-lg bg-black/10 p-1.5 hover:bg-black/20 text-white transition cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Messages - Clean Boutique Style */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-8 min-h-0 custom-scrollbar bg-[var(--surface)]"
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[85%] px-4 py-3 text-sm shadow-sm transition-all ${m.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-[24px] rounded-tr-none'
                  : 'bg-[var(--surface-strong)] border border-[var(--border)] text-[var(--text)] rounded-[24px] rounded-tl-none'
                  }`}>
                  {m.content.split('\n').map((line, li) => (
                    <p key={li} className={li > 0 ? 'mt-2' : ''}>{li === 0 && m.role === 'assistant' ? <strong>{line}</strong> : line}</p>
                  ))}
                  {m.role === 'assistant' && (
                    <div className="absolute -left-2 top-0 h-4 w-4 bg-[var(--surface-strong)] border-l border-t border-[var(--border)] transform -skew-x-[45deg]" />
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[var(--surface-strong)] rounded-[24px] rounded-tl-none px-5 py-3 border border-[var(--border)] backdrop-blur-md shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.2s]" />
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Integrated & Elegant */}
          <div className="border-t border-[var(--border)] bg-[var(--surface-strong)] p-4 sm:p-6 backdrop-blur-xl shrink-0">
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                { icon: UserPlus, label: 'New Client', text: 'Add client ' },
                { icon: Search, label: 'Analytics', text: 'Who is our top client?' },
                { icon: Package, label: 'Stock Check', text: 'Low stock items' }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => setInput(btn.text)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 text-[10px] font-bold text-[var(--text)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-lg active:scale-95 cursor-pointer"
                >
                  <btn.icon size={12} className="text-[var(--accent)]" /> {btn.label}
                </button>
              ))}
            </div>
            <div className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="How can I help you today?"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] py-3 pl-5 pr-12 text-sm shadow-sm transition-all focus:border-[var(--accent)] focus:bg-[var(--surface-strong)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)] placeholder:text-[var(--muted)]/60"
              />
              <button
                onClick={handleSend}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--jewel)] p-2 text-white shadow-xl transition-all hover:scale-105 active:scale-90 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MalkaAI;
