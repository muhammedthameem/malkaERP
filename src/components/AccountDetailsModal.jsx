import React, { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, ShieldCheck, User, Mail, Phone, Calendar, MapPin, CheckCircle2, AlertCircle, Fingerprint, Key, Trash2, Loader, Database, Download, Upload } from 'lucide-react'
import supabase from '../supabase'

function AccountDetailsModal({ fullUser, onClose, onChanged, onLogout, themeStyle }) {
  const [activeTab, setActiveTab] = useState('profile') // 'profile' or 'security'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [exportMode, setExportMode] = useState('full') // 'full' or 'custom'
  const [exportStartDate, setExportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0])
  const fileInputRef = useRef(null)

  const handleExportBackup = async () => {
    setIsExporting(true);
    setMessage(`Generating ${exportMode === 'custom' ? 'filtered' : 'full'} backup... Please wait.`);
    setStatus(null);
    try {
      const tables = ['erp_users', 'erp_clients', 'erp_orders', 'erp_sales', 'erp_inventory', 'erp_accounts', 'erp_config'];
      const backupData = {};
      
      const fetchAllPaginated = async (tableName) => {
        let allData = [];
        let from = 0;
        const step = 999;
        let hasMore = true;
        
        while (hasMore) {
          let query = supabase.from(tableName).select('*').range(from, from + step);
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += step + 1;
            if (data.length <= step) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      for (const table of tables) {
        let dateColumn = null;
        if (table === 'erp_orders') dateColumn = 'orderDate';
        if (table === 'erp_sales') dateColumn = 'timestamp';
        if (table === 'erp_clients') dateColumn = 'createdAt';
        // We do not filter inventory, users, accounts, or config so that the system remains functional
        
        let tableData = await fetchAllPaginated(table);

        if (exportMode === 'custom' && dateColumn) {
          const startTs = new Date(`${exportStartDate}T00:00:00.000Z`).getTime();
          const endTs = new Date(`${exportEndDate}T23:59:59.999Z`).getTime();
          
          tableData = tableData.filter(row => {
            const rowDate = row.data && row.data[dateColumn];
            if (!rowDate) return false;
            const d = new Date(rowDate).getTime();
            return d >= startTs && d <= endTs;
          });
        }
        
        backupData[table] = tableData;
      }
      
      const fileName = `MalkaERP_Backup_${exportMode === 'custom' ? 'Filtered_' : ''}${new Date().toISOString().slice(0,10)}.json`;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      setMessage('Backup downloaded! Opening email client...');
      setStatus('success');
      
      setTimeout(() => {
        setMessage('');
        setStatus(null);
      }, 4000);
      
      const bodyText = `Hello,\n\nPlease find the attached database backup for MalkaERP.\n(Note: You need to attach the downloaded file '${fileName}' to this email before sending.)`;
      window.location.href = `mailto:malka@gmail.com?subject=MalkaERP Database Backup&body=${encodeURIComponent(bodyText)}`;
      
    } catch (error) {
      console.error('Backup Error:', error);
      setMessage('Failed to generate backup: ' + error.message);
      setStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!window.confirm("WARNING: Importing data will overwrite conflicting records. Are you sure you want to proceed?")) {
      event.target.value = '';
      return;
    }
    
    setIsImporting(true);
    setMessage('Importing data... Please do not close this window.');
    setStatus(null);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).upsert(chunk);
          if (error) throw error;
        }
      }
      
      setMessage('Data restored successfully! Please refresh the application.');
      setStatus('success');
    } catch (error) {
      console.error('Import Error:', error);
      setMessage('Failed to import data: ' + error.message);
      setStatus('error');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  // Passkey / WebAuthn Biometrics States
  const [passkeys, setPasskeys] = useState([])
  const [passkeyError, setPasskeyError] = useState('')
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false)
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true)

  useEffect(() => {
    // Check WebAuthn support
    if (!window.PublicKeyCredential) {
      setIsWebAuthnSupported(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'security' && isWebAuthnSupported) {
      fetchPasskeys()
    }
  }, [activeTab, isWebAuthnSupported])

  const fetchPasskeys = async () => {
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) {
        if (error.message.includes('Passkeys are disabled')) {
          return; // Ignore silently if disabled in Supabase
        }
        throw error;
      }
      setPasskeys(data || [])
    } catch (err) {
      console.error('Error fetching passkeys:', err)
    }
  }

  const handleRegisterPasskey = async () => {
    setPasskeyError('')
    setIsRegisteringPasskey(true)
    try {
      // Determine device name dynamically or fall back to general naming
      let deviceName = 'My Device'
      if (navigator.userAgentData?.platform) {
        deviceName = `${navigator.userAgentData.platform} Device`
      } else if (navigator.userAgent) {
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) deviceName = 'iOS Device'
        else if (/Android/.test(navigator.userAgent)) deviceName = 'Android Device'
        else if (/Mac/.test(navigator.userAgent)) deviceName = 'Mac Device'
        else if (/Windows/.test(navigator.userAgent)) deviceName = 'Windows Device'
        else if (/Linux/.test(navigator.userAgent)) deviceName = 'Linux Device'
      }
      deviceName = `${deviceName} (${new Date().toLocaleDateString()})`

      const { data, error } = await supabase.auth.passkey.register({
        name: deviceName
      })
      if (error) throw error
      fetchPasskeys()
    } catch (err) {
      console.error('Error registering passkey:', err)
      setPasskeyError(err.message || 'Biometric registration failed. Please ensure Face ID/Fingerprint is configured on this device.')
    } finally {
      setIsRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = async (credentialId) => {
    setPasskeyError('')
    try {
      const { error } = await supabase.auth.passkey.delete(credentialId)
      if (error) throw error
      fetchPasskeys()
    } catch (err) {
      console.error('Error deleting passkey:', err)
      setPasskeyError(err.message || 'Failed to delete passkey.')
    }
  }

  const email = fullUser?.email || ''
  const name = fullUser?.name || 'User'

  const submitChangePassword = async (event) => {
    event.preventDefault()
    setMessage('')
    setStatus(null)
    setIsLoading(true)

    try {
      const { data: userData, error: fetchError } = await supabase
        .from('erp_users')
        .select('*')
        .eq('id', email)
        .single();

      if (fetchError || !userData) {
        setMessage('User profile not found.')
        setStatus('error')
        setIsLoading(false)
        return
      }

      const profile = userData.data || userData;

      // No manual password verification needed since Supabase updateUser relies on the secure active JWT session.


      if (newPassword.length < 6) {
        setMessage('New password must be 6+ characters.')
        setStatus('error')
        setIsLoading(false)
        return
      }

      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      const updatedProfile = { ...profile, password: newPassword };
      await supabase.from('erp_users').upsert([{ id: email, data: updatedProfile }]);

      setMessage('Password updated! Logging out...')
      setStatus('success')
      setTimeout(() => onChanged(), 2000)

    } catch (error) {
      setMessage(error.message || 'Something went wrong.')
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-[var(--border)] bg-[var(--surface-strong)] p-0 shadow-[var(--shadow)] relative max-h-[90vh] overflow-hidden text-[var(--text)] flex flex-col">

        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between border-b border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--accent)] grid place-items-center shadow-lg shadow-[var(--accent)]/20">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Account Center</h2>
              <p className="text-[var(--muted)] text-xs">Manage your personal business profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--soft)] transition text-[var(--muted)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 gap-8 border-b border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${activeTab === 'profile' ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            Profile Info
            {activeTab === 'profile' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text)] rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${activeTab === 'security' ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            Security & Password
            {activeTab === 'security' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text)] rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${activeTab === 'data' ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            Data Management
            {activeTab === 'data' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text)] rounded-t-full"></div>}
          </button>
        </div>

        {/* Content Area */}
        <div className="px-8 pt-8 overflow-y-auto flex-1">
          {activeTab === 'profile' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                    <User size={12} /> Full Name
                  </div>
                  <p className="font-semibold text-[var(--text)]">{name}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                    <Mail size={12} /> Email Address
                  </div>
                  <p className="font-semibold text-[var(--text)]">{email}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                    <ShieldCheck size={12} /> Designation
                  </div>
                  <p className="font-semibold text-[var(--accent)]">{fullUser?.designation || 'Staff Member'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                    <Phone size={12} /> Phone Number
                  </div>
                  <p className="font-semibold text-[var(--text)]">{fullUser?.phone || 'Not Provided'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                    <Calendar size={12} /> Member Since
                  </div>
                  <p className="font-semibold text-[var(--text)]">
                    {fullUser?.createdAt ? new Date(fullUser.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-center gap-2 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest mb-1">
                  <MapPin size={12} /> Work Address / Location
                </div>
                <p className="font-semibold text-[var(--text)] text-sm leading-relaxed">{fullUser?.address || 'No office address assigned.'}</p>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-bold text-sm text-[var(--text)] hover:bg-[var(--soft)] transition"
                >
                  Close Profile
                </button>

              </div>
            </div>
          ) : activeTab === 'security' ? (
            <div className="space-y-6 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <form onSubmit={submitChangePassword} className="space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2 block">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 transition text-[var(--text)]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2 block">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 transition text-[var(--text)]"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {message && (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'
                    }`}>
                    {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{message}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="flex-1 px-6 py-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-bold text-sm text-[var(--text)] hover:bg-[var(--soft)] transition"
                  >
                    Back to Profile
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-[2] bg-[var(--accent)] px-6 py-4 rounded-xl font-bold text-sm text-white shadow-lg shadow-[var(--accent)]/20 hover:brightness-95 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* Biometric Section */}
              <div className="border-t border-[var(--border)] pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="text-[var(--accent)]" size={20} />
                    <h3 className="font-bold text-base text-[var(--text)]">Biometric Login (Passkeys)</h3>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)]/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">
                    Secure
                  </span>
                </div>
                <p className="text-[var(--muted)] text-xs leading-relaxed">
                  Log in safely using your device's fingerprint or facial recognition (Face ID, Touch ID, Windows Hello) without entering your password.
                </p>

                {passkeyError && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs">
                    <AlertCircle size={14} />
                    <p className="font-medium">{passkeyError}</p>
                  </div>
                )}

                {isWebAuthnSupported ? (
                  <div className="space-y-4">
                    {/* List Registered Passkeys */}
                    {passkeys.length > 0 ? (
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Registered Devices</p>
                        <div className="space-y-2">
                          {passkeys.map((key) => (
                            <div key={key.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--soft)] text-[var(--muted)]">
                                  <Key size={14} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text)]">{key.name || 'Unnamed Device'}</p>
                                  <p className="text-[10px] text-[var(--muted)] font-medium">Added: {new Date(key.created_at || key.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePasskey(key.id)}
                                className="p-2 text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                                title="Remove device credential"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)]/30">
                        <Fingerprint size={32} className="mx-auto text-[var(--muted)]/50 mb-2" />
                        <p className="text-xs font-semibold text-[var(--muted)]">No biometric credentials registered yet</p>
                        <p className="text-[10px] text-[var(--muted)]/70 mt-1">Register this phone or laptop below to enable Face ID / fingerprint sign-in.</p>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isRegisteringPasskey}
                      onClick={handleRegisterPasskey}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--soft)] border border-[var(--accent)]/10 px-5 py-3 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)]/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isRegisteringPasskey ? (
                        <>
                          <Loader size={14} className="animate-spin" />
                          Following device prompts...
                        </>
                      ) : (
                        <>
                          <Fingerprint size={14} />
                          Register Face ID / Fingerprint on this device
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-600 flex items-start gap-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">WebAuthn not supported</p>
                      <p className="text-[10px] text-yellow-600/80 mt-1 leading-relaxed">
                        Your current browser or device does not support biometric credentials. Ensure you are using a modern browser (Safari, Chrome, Firefox) and the site is served over a secure connection (HTTPS).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'data' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {message && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
                  {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <p className="text-sm font-medium">{message}</p>
                </div>
              )}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="text-[var(--accent)]" size={20} />
                  <h3 className="font-bold text-base text-[var(--text)]">Backup Data</h3>
                </div>
                <p className="text-[var(--muted)] text-xs leading-relaxed">
                  Download a secure snapshot of your entire database (Orders, Clients, Sales, Inventory, etc.) to your local computer.
                </p>

                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                    <input type="radio" checked={exportMode === 'full'} onChange={() => setExportMode('full')} className="accent-[var(--accent)]" />
                    Full Backup
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                    <input type="radio" checked={exportMode === 'custom'} onChange={() => setExportMode('custom')} className="accent-[var(--accent)]" />
                    Custom Date Range
                  </label>
                </div>

                {exportMode === 'custom' && (
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest block mb-1">Start Date</label>
                      <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest block mb-1">End Date</label>
                      <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 hover:brightness-95 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {isExporting ? (
                    <><Loader size={16} className="animate-spin" /> Generating Backup...</>
                  ) : (
                    <><Download size={16} /> Download {exportMode === 'custom' ? 'Filtered ' : 'Full '} Backup & Email</>
                  )}
                </button>
              </div>

              <div className="space-y-4 border-t border-[var(--border)] pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="text-[var(--accent)]" size={20} />
                  <h3 className="font-bold text-base text-[var(--text)]">Restore Data</h3>
                </div>
                <p className="text-[var(--muted)] text-xs leading-relaxed">
                  Upload a previously downloaded `.json` backup file. <strong className="text-red-500 font-bold">Warning:</strong> This will overwrite existing records with the data in the backup.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImportBackup}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-4 text-sm font-bold text-[var(--text)] hover:bg-[var(--soft)] transition disabled:opacity-50"
                  >
                    {isImporting ? (
                      <><Loader size={16} className="animate-spin" /> Restoring Data...</>
                    ) : (
                      <><Upload size={16} /> Choose Backup File to Restore</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="h-8 flex-shrink-0"></div>
        </div>
      </div>
    </div>
  )
}

export default AccountDetailsModal