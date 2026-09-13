import React, { useState, useEffect, useRef } from 'react'
import { Search, Eye, Pencil, Trash2, ChevronDown, Plus } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import supabase from '../../supabase'

function ViewUsersPage({ themeStyle, setCurrentPage, users, setUsers, designations, setDesignations, showGlobalToast, currentUser, cloudLoaded }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewUser, setViewUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false)
  const [designationSearch, setDesignationSearch] = useState('')
  const [expandedMobileId, setExpandedMobileId] = useState(null)

  const [userToDelete, setUserToDelete] = useState(null)

  const isDataLoading = !cloudLoaded && (!users || users.length === 0);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    const id = userToDelete.id
    
    // Security checks
    if (userToDelete.designation === 'Admin') {
      if (showGlobalToast) showGlobalToast('Error', 'Admin accounts cannot be deleted.')
      setUserToDelete(null)
      return
    }
    if (currentUser && id === currentUser.id) {
      if (showGlobalToast) showGlobalToast('Error', 'You cannot delete yourself.')
      setUserToDelete(null)
      return
    }

    // --- INSTANT UI UPDATE (Optimistic) ---
    const originalUsers = [...users];
    setUsers(users.filter(u => u.id !== id));
    setUserToDelete(null); // Close modal instantly

    try {
      // Tell cloud to delete in background using our secure function
      const { error } = await supabase.rpc('delete_user', { user_email: id });
      if (error) throw error;
      
      if (showGlobalToast) showGlobalToast('Success', `${userToDelete.name} successfully deleted`)
    } catch (error) {
      // ROLLBACK: If cloud fails, put the user back
      setUsers(originalUsers);
      console.error("Cloud Sync Failed:", error.message);
      if (showGlobalToast) showGlobalToast('Error', 'Cloud sync failed. User restored.')
    }
  }

  const handleUpdateUser = (e) => {
    e.preventDefault()
    if (editUser.password !== editUser.repeatPassword) {
      if (showGlobalToast) showGlobalToast('Error', 'Passwords do not match.')
      return
    }

    // Update in users list
    const updatedUsers = users.map(u => u.id === editUser.id ? editUser : u)
    setUsers(updatedUsers)

    // If the edited user is the current logged-in user, update session
    if (currentUser && editUser.id === currentUser.id) {
      const updatedSession = {
        ...currentUser,
        name: editUser.name,
        email: editUser.email,
        role: editUser.designation
      }
      localStorage.setItem('erp_session', JSON.stringify({
        user: updatedSession,
        timestamp: Date.now()
      }))
      // Note: We don't have a setUser prop here to update App.jsx state instantly, 
      // but the Dashboard will use the updated users list for the header.
    }

    setEditUser(null)
    if (showGlobalToast) showGlobalToast('Success', 'User details updated successfully.')
  }

  const uniqueUsersMap = new Map()
  users.forEach(u => {
    if (!uniqueUsersMap.has(u.email) || (u.updatedAt && new Date(u.updatedAt) > new Date(uniqueUsersMap.get(u.email).updatedAt || 0))) {
      uniqueUsersMap.set(u.email, u)
    }
  })

  const filteredUsers = Array.from(uniqueUsersMap.values()).filter(u =>
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.designation || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    // 1. MOVE CURRENT USER TO TOP
    if (currentUser) {
      if (a.email === currentUser.email) return -1;
      if (b.email === currentUser.email) return 1;
    }
    
    // 2. TIE-BREAKER: Sort everyone else alphabetically by name
    return (a.name || '').localeCompare(b.name || '');
  })

  return (
    <div style={themeStyle} className="relative">
      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-8 relative">
            <button className="absolute top-6 right-6 text-[var(--muted)] hover:text-[var(--text)] transition" onClick={() => setViewUser(null)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="flex items-center gap-6 mb-8">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-[var(--accent)] text-3xl font-black text-white">
                {viewUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {viewUser.name}
                  {currentUser && viewUser.email === currentUser.email && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">You</span>
                  )}
                </h2>
                <p className="text-[var(--muted)]">{viewUser.designation}</p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Contact Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--muted)]">Email</p>
                    <p className="text-base font-semibold">{viewUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--muted)]">Phone</p>
                    <p className="text-base font-semibold">{viewUser.phone}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Address</p>
                <p className="text-base font-semibold">{viewUser.address || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Account Info</p>
                <p className="text-sm text-[var(--muted)]">User ID: <span className="font-mono text-[var(--text)]">{viewUser.id}</span></p>
                <p className="text-sm text-[var(--muted)]">Created: <span className="text-[var(--text)]">{new Date(viewUser.createdAt).toLocaleDateString()}</span></p>
              </div>
            </div>
            <div className="mt-10 flex justify-end">
              <button className="rounded-xl bg-[var(--accent)] px-8 py-3 font-bold text-white shadow-lg transition hover:brightness-95" onClick={() => setViewUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Pencil size={24} className="text-[var(--accent)]" /> Edit User: {editUser.name}
            </h2>
            <form onSubmit={handleUpdateUser} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[var(--text)]">User Name</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                    type="text"
                    value={editUser.name}
                    onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--text)]">Email (Read-only)</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--soft)] px-4 py-3 outline-none cursor-not-allowed opacity-70"
                    type="email"
                    value={editUser.email}
                    readOnly
                    title="Email cannot be changed after account creation"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--text)]">Phone</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                    type="tel"
                    value={editUser.phone}
                    onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                    required
                  />
                </label>
                <div className="relative block">
                  <span className="text-sm font-medium text-[var(--text)]">Designation</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                    type="text"
                    value={editUser.designation}
                    onChange={(e) => {
                      setEditUser({ ...editUser, designation: e.target.value })
                      setDesignationSearch(e.target.value)
                      setShowDesignationDropdown(true)
                    }}
                    onFocus={() => setShowDesignationDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDesignationDropdown(false), 200)}
                    placeholder="Search or add designation..."
                    required
                  />
                  {showDesignationDropdown && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-lg">
                      {(designations || [])
                        .filter(d => d.toLowerCase().includes(designationSearch.toLowerCase()))
                        .map((d) => (
                          <button
                            key={d}
                            className="w-full px-4 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--soft)]"
                            onClick={() => {
                              setEditUser({ ...editUser, designation: d })
                              setDesignationSearch(d)
                              setShowDesignationDropdown(false)
                            }}
                            type="button"
                          >
                            {d}
                          </button>
                        ))}
                      {designationSearch && !designations.some(d => d.toLowerCase() === designationSearch.toLowerCase()) && (
                        <button
                          className="w-full px-4 py-2 text-left text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--soft)]"
                          onClick={() => {
                            const newDesignation = designationSearch.trim()
                            if (newDesignation && !designations.includes(newDesignation)) {
                              setDesignations([...designations, newDesignation])
                              setEditUser({ ...editUser, designation: newDesignation })
                              setDesignationSearch(newDesignation)
                              setShowDesignationDropdown(false)
                            }
                          }}
                          type="button"
                        >
                          + Add "{designationSearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-[var(--text)]">Address</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                    type="text"
                    value={editUser.address || ''}
                    onChange={(e) => setEditUser({ ...editUser, address: e.target.value })}
                    required
                  />
                </label>
                <label className="block relative">
                  <span className="text-sm font-medium text-[var(--text)]">Update Password</span>
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pr-12 outline-none transition focus:border-[var(--accent)]"
                      type={showPassword ? 'text' : 'password'}
                      value={editUser.password || ''}
                      onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-md transition"
                    >
                      <Eye size={18} className={!showPassword ? 'opacity-50' : ''} />
                    </button>
                  </div>
                </label>
                <label className="block relative">
                  <span className="text-sm font-medium text-[var(--text)]">Repeat Password</span>
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pr-12 outline-none transition focus:border-[var(--accent)]"
                      type={showRepeatPassword ? 'text' : 'password'}
                      value={editUser.repeatPassword || editUser.password || ''}
                      onChange={(e) => setEditUser({ ...editUser, repeatPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-md transition"
                    >
                      <Eye size={18} className={!showRepeatPassword ? 'opacity-50' : ''} />
                    </button>
                  </div>
                </label>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 font-semibold transition hover:bg-[var(--soft)]"
                  type="button"
                  onClick={() => setEditUser(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-lg transition hover:brightness-95"
                  type="submit"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-8 shadow-2xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Trash2 size={32} />
            </div>

            <h3 className="text-2xl font-bold text-[var(--text)]">Delete User?</h3>
            <p className="mt-3 text-[var(--muted)] leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-[var(--text)]">{userToDelete.name}</span>? This action will permanently remove their access to the Malka ERP system.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3.5 font-bold transition hover:bg-[var(--soft)]"
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-500 py-3.5 font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
                onClick={handleConfirmDelete}
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">View Users</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage your team members and roles</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md flex-1">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--muted)] shadow-sm focus-within:border-[var(--accent)] transition-colors">
              <Search size={18} />
              <input
                className="w-full bg-transparent outline-none placeholder:text-[var(--muted)] font-medium"
                placeholder="Search users..."
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto">
            {currentUser?.role === 'Admin' && (
              <button
                onClick={() => setCurrentPage('create-user')}
                className="flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-95 active:scale-95 whitespace-nowrap"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add New User</span>
                <span className="sm:hidden">Add User</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
        <div className="erp-table-container hidden lg:block">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isDataLoading ? (
                // Skeleton Table Rows
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton h-5 w-32 rounded" /></td>
                    <td><div className="skeleton h-5 w-48 rounded" /></td>
                    <td><div className="skeleton h-5 w-32 rounded" /></td>
                    <td><div className="skeleton h-6 w-24 rounded-lg" /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <div className="skeleton h-8 w-8 rounded-lg" />
                        <div className="skeleton h-8 w-8 rounded-lg" />
                        <div className="skeleton h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isCurrentUser = currentUser && user.email === currentUser.email;
                  return (
                    <tr 
                      key={user.id} 
                      className={`transition-colors ${isCurrentUser ? 'bg-[var(--accent)]/5 border-l-4 border-l-[var(--accent)]' : 'hover:bg-[var(--soft)]/50'}`}
                    >
                      <td className="font-semibold">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {isCurrentUser && (
                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">You</span>
                          )}
                        </div>
                      </td>
                      <td className="text-[var(--muted)]">{user.email}</td>
                      <td className="text-[var(--muted)]">{user.phone}</td>
                      <td>
                        <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs font-semibold text-[var(--text)]">
                          {user.designation}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewUser(user)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                            title="View User"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {/* Only Admins can edit/delete others */}
                          {currentUser?.role === 'Admin' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditUser({ ...user, repeatPassword: user.password })
                                  setDesignationSearch(user.designation)
                                }}
                                className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                                title="Edit User"
                              >
                                <Pencil size={16} />
                              </button>
                              
                              {/* Cannot delete oneself or any Admin */}
                              {isCurrentUser || user.designation === 'Admin' ? (
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-stone-100 text-stone-300 cursor-not-allowed" title={isCurrentUser ? "You cannot delete yourself" : "Admin accounts cannot be deleted"}>
                                  <Trash2 size={16} />
                                </div>
                              ) : (
                                <button
                                  onClick={() => setUserToDelete(user)}
                                  className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white"
                                  title="Delete User"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[var(--muted)]">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="block lg:hidden mt-4 h-[65vh] -mx-4 px-4">
          <Virtuoso
            data={filteredUsers}
            overscan={200}
            itemContent={(index, user) => {
              const isExpanded = expandedMobileId === user.id;
              const isCurrentUser = currentUser && user.email === currentUser.email;
              return (
                <div className={`mb-3 rounded-2xl border ${isExpanded ? 'border-[var(--accent)] shadow-md bg-[var(--surface-strong)]' : 'border-[var(--border)] bg-[var(--surface)]'} overflow-hidden transition-all duration-300`}>
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedMobileId(isExpanded ? null : user.id)}
                  >
                    <div className="flex flex-col gap-1 w-full max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--accent)] truncate">{user.name}</span>
                        {isCurrentUser && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">You</span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--text)]">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs font-semibold text-[var(--text)]">{user.designation}</span>
                      <div className={`transition-transform duration-300 text-[var(--muted)] ${isExpanded ? 'rotate-180 text-[var(--accent)]' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="pt-3 border-t border-[var(--border)] mb-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--muted)] font-semibold">Phone:</span>
                          <span className="font-medium text-[var(--text)]">{user.phone}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs hover:bg-[var(--accent)] hover:text-white transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewUser(user)
                          }}
                        >
                          <Eye size={16} /> View Profile
                        </button>
                        {currentUser?.role === 'Admin' && (
                          <button
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditUser({ ...user, repeatPassword: user.password })
                              setDesignationSearch(user.designation)
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {currentUser?.role === 'Admin' && !isCurrentUser && user.designation !== 'Admin' && (
                          <button
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete(user)
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
      </section>
    </div>
  )
}

export default ViewUsersPage;
