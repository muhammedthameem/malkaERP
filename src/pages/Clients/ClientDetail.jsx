import React, { useState, useEffect, useRef } from 'react'
import { ImageIcon, ChevronDown, ChevronLeft, Package, Search, Settings, ShoppingBag, UsersRound, Pencil, Trash2, Plus } from 'lucide-react'
import { formatDateDDMMYY, formatDateTimeDDMMYY, products } from '../../utils/constants'
import supabase from '../../supabase'
import { compressImage } from '../../utils/imageCompression'
import SketchBoard, { hasSketch } from '../../components/SketchBoard'

const topFields = [
  { key: 'upChest', label: 'Up-Chest' },
  { key: 'chest', label: 'Chest' },
  { key: 'bust', label: 'Bust' },
  { key: 'waist', label: 'Waist' },
  { key: 'hip', label: 'Hip' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'yoke', label: 'Yoke' },
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'neckF', label: 'Neck F' },
  { key: 'neckB', label: 'Neck B' },
  { key: 'sleeveLength', label: 'Sleeve Length' },
  { key: 'sleeveRound', label: 'Sleeve Round' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'armRound', label: 'Arm Round' },
  { key: 'halfSleeves', label: 'Half Sleeves' },
  { key: 'fullSleeves', label: 'Full Sleeves' },
  { key: 'threeQuarterSleeves', label: '3/4 Sleeves' },
  { key: 'elbow', label: 'Elbow' }
]

function ClientDetailPage({ themeStyle, client, setCurrentPage, setSelectedClient, initialMode, setClientDetailMode, showGlobalToast, currentUser, clients, setClients, saveClient, deleteClient, productTypes = [], setProductTypes, saveConfig }) {
  const [clientsList, setClientsList] = useState([])
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  useEffect(() => {
    setClientsList(JSON.parse(localStorage.getItem('clients') || '[]'))
  }, [])

  useEffect(() => {
    if (localStorage.getItem('triggerAddMeasurement') === 'true') {
      setIsAddingMeasurement(true)
      localStorage.removeItem('triggerAddMeasurement')
    }
  }, [])

  const [selectedMeasurementIndex, setSelectedMeasurementIndex] = useState(() => {
    return client?.measurements?.length > 0 ? client.measurements.length - 1 : 0;
  })
  const [showMeasurementDropdown, setShowMeasurementDropdown] = useState(false)

  const defaultTop = {
    length: '',
    upChestLength: '', upChestRound: '',
    chestLength: '', chestRound: '',
    bustLength: '', bustRound: '',
    waistLength: '', waistRound: '',
    hipLength: '', hipRound: '',
    shoulderLength: '', shoulderRound: '',
    yokeLength: '', yokeRound: '',
    frontLength: '', frontRound: '',
    backLength: '', backRound: '',
    neckFLength: '', neckFRound: '',
    neckBLength: '', neckBRound: '',
    sleeveLengthLength: '', sleeveLengthRound: '', sleeveLength: '',
    sleeveRoundLength: '', sleeveRoundRound: '', sleeveRound: '',
    bicepsLength: '', bicepsRound: '', biceps: '',
    armRoundLength: '', armRoundRound: '', armRound: '',
    halfSleevesLength: '', halfSleevesRound: '',
    fullSleevesLength: '', fullSleevesRound: '',
    threeQuarterSleevesLength: '', threeQuarterSleevesRound: '',
    elbowLength: '', elbowRound: ''
  }
  const defaultBottom = { length: '', waistLength: '', waistRound: '', hipLength: '', hipRound: '', thighsLength: '', thighsRound: '', kneeLength: '', kneeRound: '', calfLength: '', calfRound: '', ankleLength: '', ankleRound: '', crotchLength: '', crotchRound: '' }

  const [isAddingMeasurement, setIsAddingMeasurement] = useState(false)
  const [isEditingClient, setIsEditingClient] = useState(initialMode === 'edit')
  const [showTopAccordion, setShowTopAccordion] = useState(true)
  const [showBottomAccordion, setShowBottomAccordion] = useState(false)

  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [clientToDelete, setClientToDelete] = useState(null)

  const [product, setProduct] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const commonProducts = productTypes.length > 0 ? productTypes : [
    'Shirt', 'T-Shirt', 'Blouse', 'Kurta', 'Pants', 'Jeans', 'Trousers', 'Dress', 'Saree', 
    'Salwar Kameez', 'Lehenga', 'Blazer', 'Suit', 'Jacket', 'Coat', 'Skirt', 'Shorts', 
    'Sweater', 'Cardigan', 'Anarkali'
  ]
  const [topMeasurements, setTopMeasurements] = useState(defaultTop)
  const [bottomMeasurements, setBottomMeasurements] = useState(defaultBottom)
  const [note, setNote] = useState('')
  const [sketch, setSketch] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const [measurementToDelete, setMeasurementToDelete] = useState(null)
  const [showMergePopup, setShowMergePopup] = useState(false)
  const [pendingMeasurementData, setPendingMeasurementData] = useState(null)
  const [imagePopup, setImagePopup] = useState(null)

  useEffect(() => {
    setIsEditingClient(initialMode === 'edit')
  }, [initialMode])

  useEffect(() => {
    if (client) {
      setEditName(client.name || '')
      setEditMobile(client.mobile || '')
      setEditAddress(client.address || '')

      const measurementsList = client.measurements?.length > 0 ? client.measurements : [{
        product: client.product,
        topMeasurements: client.topMeasurements || {},
        bottomMeasurements: client.bottomMeasurements || {},
        note: client.note
      }]

      const current = measurementsList[selectedMeasurementIndex] || measurementsList[0]

      if (initialMode === 'edit' || isEditingClient) {
        setProduct(current.product || '')
        setProductSearch(current.product || '')
        const loadedTop = { ...defaultTop, ...current.topMeasurements }
        if (!loadedTop.sleeveLength && loadedTop.sleeveLengthLength) loadedTop.sleeveLength = loadedTop.sleeveLengthLength
        if (!loadedTop.sleeveRound && loadedTop.sleeveRoundRound) loadedTop.sleeveRound = loadedTop.sleeveRoundRound
        if (!loadedTop.bicepsRound && loadedTop.biceps) loadedTop.bicepsRound = loadedTop.biceps
        if (!loadedTop.armRoundRound && loadedTop.armRound) loadedTop.armRoundRound = loadedTop.armRound
        setTopMeasurements(loadedTop)
        setBottomMeasurements({ ...defaultBottom, ...current.bottomMeasurements })
        setNote(current.note || '')
        setSketch(current.sketch || null)
      } else if (!isAddingMeasurement) {
        setProduct('')
        setProductSearch('')
        setTopMeasurements(defaultTop)
        setBottomMeasurements(defaultBottom)
        setNote('')
        setSketch(null)
      } else {
        // Clear for new measurement
        setProduct('')
        setProductSearch('')
        setTopMeasurements(defaultTop)
        setBottomMeasurements(defaultBottom)
        setNote('')
        setSketch(null)
      }
    }
  }, [client, selectedMeasurementIndex, initialMode, isEditingClient, isAddingMeasurement])

  if (!client) {
    return (
      <div style={themeStyle}>
        <div className="mb-6">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:underline"
            onClick={() => setCurrentPage('view-clients')}
          >
            <ChevronLeft size={16} /> Back to Clients
          </button>
        </div>
        <p className="text-center text-[var(--muted)]">No client selected</p>
      </div>
    )
  }

  // Handle both old format and new format with multiple measurements
  const measurements = client.measurements?.length > 0 ? client.measurements : [{
    product: client.product,
    topMeasurements: client.topMeasurements || {},
    bottomMeasurements: client.bottomMeasurements || {},
    note: client.note,
    photoUrl: client.photoUrl,
    createdAt: client.createdAt
  }]

  const currentMeasurement = measurements[selectedMeasurementIndex] || measurements[0]

  const hasData = (measurementsObj) => {
    if (!measurementsObj) return false;
    return Object.values(measurementsObj).some(val => val !== '' && val !== null && val !== undefined);
  };
  
  const showTopSection = isAddingMeasurement || hasData(currentMeasurement.topMeasurements);
  const showBottomSection = isAddingMeasurement || hasData(currentMeasurement.bottomMeasurements);
  const isEmptyMeasurement = !hasData(currentMeasurement.topMeasurements) && !hasData(currentMeasurement.bottomMeasurements) && !isAddingMeasurement && !isEditingClient;
  const displayTop = showTopSection || isEditingClient;
  const displayBottom = showBottomSection || isEditingClient;

  const handleDeletePhoto = () => {
    if (window.confirm("Are you sure you want to delete this measurement photo?")) {
      const clientListToSearch = clients || [];
      const clientIndex = clientListToSearch.findIndex(c => String(c.id) === String(client.id));
      if (clientIndex >= 0) {
        const updatedClient = { ...clientListToSearch[clientIndex] };
        if (updatedClient.measurements && updatedClient.measurements[selectedMeasurementIndex]) {
          updatedClient.measurements[selectedMeasurementIndex].photoUrl = null;
        } else {
          updatedClient.photoUrl = null;
        }
        saveClientAndClose(updatedClient, selectedMeasurementIndex, false, false);
      }
    }
  }

  const handleSaveMeasurement = async (e) => {
    e.preventDefault()

    if (isAddingMeasurement && client.measurements?.length > 0) {
      const existingMatch = client.measurements.find(m => m.product?.toLowerCase() === product.toLowerCase().trim());
      if (existingMatch) {
        setPendingMeasurementData({ product, topMeasurements, bottomMeasurements, note, sketch });
        setShowMergePopup(true);
        return; // Halt save process
      }
    }

    let uploadedPhotoUrl = undefined;
    if (photoFile) {
      setIsUploading(true);
      try {
        const compressedPhoto = await compressImage(photoFile);
        const fileExt = compressedPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error } = await supabase.storage.from('measurements').upload(fileName, compressedPhoto);
        if (error) throw error;
        
        const { data } = supabase.storage.from('measurements').getPublicUrl(fileName);
        uploadedPhotoUrl = data.publicUrl;
      } catch (err) {
        console.error('Error uploading photo:', err);
        try {
          const compressedPhoto = await compressImage(photoFile);
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(compressedPhoto);
          });
          uploadedPhotoUrl = base64;
          if (showGlobalToast) showGlobalToast('Storage Upload Failed', 'Falling back to local database storage for image.');
        } catch (b64Err) {
          if (showGlobalToast) showGlobalToast('Upload Failed', err.message || 'Could not upload measurement photo.');
        }
      } finally {
        setIsUploading(false);
      }
    }

    executeSaveMeasurement({ product, topMeasurements, bottomMeasurements, note, sketch, photoUrl: uploadedPhotoUrl });
  }

  const handleMergeMeasurement = () => {
    const existingIndex = client.measurements.findIndex(m => m.product?.toLowerCase() === pendingMeasurementData.product.toLowerCase().trim());
    if (existingIndex !== -1) {
      const oldMeasurement = client.measurements[existingIndex];
      const mergedData = {
        product: oldMeasurement.product,
        topMeasurements: { ...oldMeasurement.topMeasurements, ...pendingMeasurementData.topMeasurements },
        bottomMeasurements: { ...oldMeasurement.bottomMeasurements, ...pendingMeasurementData.bottomMeasurements },
        note: pendingMeasurementData.note ? pendingMeasurementData.note : oldMeasurement.note,
        sketch: hasSketch(pendingMeasurementData.sketch) ? pendingMeasurementData.sketch : (oldMeasurement.sketch || null)
      };
      
      const newMeasurements = [...client.measurements];
      newMeasurements[existingIndex] = { ...oldMeasurement, ...mergedData };
      
      const updatedClient = { ...client, name: editName, mobile: editMobile, address: editAddress, measurements: newMeasurements };
      
      saveClientAndClose(updatedClient, existingIndex, false, true);
    }
    setShowMergePopup(false);
    setPendingMeasurementData(null);
  }

  const handleRecordAsNew = () => {
    const baseName = pendingMeasurementData.product.trim();
    let maxNum = 0;
    client.measurements.forEach(m => {
      const p = m.product || '';
      if (p.toLowerCase().startsWith(baseName.toLowerCase())) {
        const suffix = p.substring(baseName.length).trim();
        if (suffix === '') {
          // base name
        } else if (!isNaN(parseInt(suffix))) {
          maxNum = Math.max(maxNum, parseInt(suffix));
        }
      }
    });
    
    const newProductName = maxNum > 0 ? `${baseName} ${maxNum + 1}` : `${baseName} 1`;
    const newMeasurement = { ...pendingMeasurementData, product: newProductName };
    executeSaveMeasurement(newMeasurement);
    setShowMergePopup(false);
    setPendingMeasurementData(null);
  }

  const saveClientAndClose = (updatedClient, newIndex, wasAdding, wasEditing) => {
    // Eagerly update local state for zero-lag UI
    if (setClients) {
      setClients(prev => {
        const next = [...prev];
        const idx = next.findIndex(c => String(c.id) === String(updatedClient.id));
        if (idx >= 0) next[idx] = updatedClient;
        else next.push(updatedClient);
        return next;
      });
    }

    if (saveClient) {
      saveClient(updatedClient);
    } else {
      const saved = JSON.parse(localStorage.getItem('clients') || '[]');
      const idx = saved.findIndex(c => c.id === updatedClient.id);
      if (idx >= 0) saved[idx] = updatedClient;
      else saved.push(updatedClient);
      localStorage.setItem('clients', JSON.stringify(saved));
    }

    setSelectedClient(updatedClient)
    setSelectedMeasurementIndex(newIndex)

    setIsAddingMeasurement(false)
                    setPhotoFile(null)
    setIsEditingClient(false)
    if (setClientDetailMode) setClientDetailMode('view')
                    setPhotoFile(null)

    if (showGlobalToast) {
      const action = wasEditing ? 'Updated' : 'Added measurement for';
      showGlobalToast(`Client ${wasEditing ? 'Updated' : 'Measurement Added'}`, `${action} ${updatedClient.name}`);
    }
  }

  const executeSaveMeasurement = (measurementToSave) => {
    const clientListToSearch = clients || [];
    const clientIndex = clientListToSearch.findIndex(c => String(c.id) === String(client.id));

    if (clientIndex >= 0) {
      const updatedClient = { ...clientListToSearch[clientIndex] };

      if (!updatedClient.measurements) {
        updatedClient.measurements = [{
          product: updatedClient.product,
          topMeasurements: updatedClient.topMeasurements || {},
          bottomMeasurements: updatedClient.bottomMeasurements || {},
          note: updatedClient.note,
          photoUrl: updatedClient.photoUrl,
          createdAt: updatedClient.createdAt || new Date().toISOString()
        }]
      }

      if (isEditingClient && !isAddingMeasurement) {
        const duplicateIndex = clientListToSearch.findIndex(c => 
          String(c.id) !== String(client.id) &&
          c.mobile === editMobile && 
          (c.name || '').trim().toLowerCase() === (editName || '').trim().toLowerCase()
        );

        if (duplicateIndex >= 0) {
          if (showGlobalToast) showGlobalToast('Duplicate Client', `A client with the name "${editName}" and mobile "${editMobile}" already exists.`);
          return;
        }

        updatedClient.name = editName
        updatedClient.mobile = editMobile
        updatedClient.address = editAddress

        updatedClient.measurements[selectedMeasurementIndex] = {
          ...updatedClient.measurements[selectedMeasurementIndex],
          product: measurementToSave.product,
          topMeasurements: measurementToSave.topMeasurements,
          bottomMeasurements: measurementToSave.bottomMeasurements,
          note: measurementToSave.note,
          sketch: measurementToSave.sketch || null
        }
        if (measurementToSave.photoUrl !== undefined) {
          updatedClient.measurements[selectedMeasurementIndex].photoUrl = measurementToSave.photoUrl;
        }
      } else if (isAddingMeasurement && !isEditingClient) {
        const measurementData = {
          id: Date.now(),
          ...measurementToSave,
          addedBy: currentUser?.name || currentUser?.email || 'Admin',
          createdAt: new Date().toISOString()
        }
        updatedClient.measurements.push(measurementData)
      } else if (isEditingClient && isAddingMeasurement) {
        updatedClient.name = editName
        updatedClient.mobile = editMobile
        updatedClient.address = editAddress

        const measurementData = {
          id: Date.now(),
          ...measurementToSave,
          addedBy: currentUser?.name || currentUser?.email || 'Admin',
          createdAt: new Date().toISOString()
        }
        updatedClient.measurements.push(measurementData)
      }

      const newIndex = isAddingMeasurement ? updatedClient.measurements.length - 1 : selectedMeasurementIndex;
      saveClientAndClose(updatedClient, newIndex, isAddingMeasurement, isEditingClient);
    } else {
      const measurementData = {
        id: Date.now(),
        ...measurementToSave,
        addedBy: currentUser?.name || currentUser?.email || 'Admin',
        createdAt: new Date().toISOString()
      }

      const newClient = {
        id: client.id || Date.now(),
        name: editName,
        mobile: editMobile,
        address: editAddress,
        createdAt: new Date().toISOString(),
        measurements: [measurementData]
      }

      // Eagerly update local state for zero-lag UI
      if (setClients) setClients(prev => [...prev, newClient]);

      if (saveClient) {
        saveClient(newClient);
      } else {
        const saved = JSON.parse(localStorage.getItem('clients') || '[]');
        saved.push(newClient);
        localStorage.setItem('clients', JSON.stringify(saved));
      }

      setSelectedClient(newClient)
      setSelectedMeasurementIndex(0)
      setIsAddingMeasurement(false)
                    setPhotoFile(null)
      setIsEditingClient(false)
      if (setClientDetailMode) setClientDetailMode('view')
                    setPhotoFile(null)

      if (showGlobalToast) showGlobalToast('New Client Created', `Successfully registered ${newClient.name}`);
    }
  }

  return (
    <div style={themeStyle} className="relative">
      {clientToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-[var(--text)]">Delete Client</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Are you sure you want to delete <span className="font-semibold text-[var(--text)]">{clientToDelete.name}</span>? This action cannot be undone and will remove all their associated measurements.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--soft)]"
                onClick={() => setClientToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={async () => {
                  try {
                    const idToDelete = clientToDelete.id
                    // 1. Cloud Delete
                    if (deleteClient) {
                      await deleteClient(idToDelete);
                    } else {
                      await supabase.from('erp_clients').delete().eq('id', idToDelete.toString());
                    }

                    // 2. Update local UI (Optimistic)
                    if (setClients) {
                      setClients(prev => prev.filter(c => String(c.id) !== String(idToDelete)));
                    }
                    setClientToDelete(null)
                    if (showGlobalToast) showGlobalToast('Client Removed', 'Profile and measurements deleted permanently.');
                    setCurrentPage('view-clients')
                  } catch (err) {
                    console.error("Delete failed:", err);
                  }
                }}
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}

      {measurementToDelete !== null && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-[var(--text)]">Delete Measurement</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Are you sure you want to delete the <span className="font-semibold text-[var(--text)]">{client.measurements[measurementToDelete]?.product || 'measurement'}</span>? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--soft)]"
                onClick={() => setMeasurementToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => {
                  const newMeasurements = [...client.measurements];
                  newMeasurements.splice(measurementToDelete, 1);
                  const updatedClient = { ...client, measurements: newMeasurements };
                  
                  // Eagerly update local state for zero-lag UI
                  if (setClients) {
                    setClients(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(c => String(c.id) === String(updatedClient.id));
                      if (idx >= 0) next[idx] = updatedClient;
                      return next;
                    });
                  }

                  if (saveClient) {
                    saveClient(updatedClient);
                  } else {
                    const saved = JSON.parse(localStorage.getItem('clients') || '[]');
                    const idx = saved.findIndex(c => c.id === updatedClient.id);
                    if (idx >= 0) saved[idx] = updatedClient;
                    else saved.push(updatedClient);
                    localStorage.setItem('clients', JSON.stringify(saved));
                  }
                  
                  setSelectedClient(updatedClient);
                  setSelectedMeasurementIndex(0);
                  setMeasurementToDelete(null);
                  if (showGlobalToast) showGlobalToast('Measurement Deleted', 'The measurement has been removed successfully.');
                }}
              >
                Delete Measurement
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergePopup && pendingMeasurementData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-[var(--text)]">Duplicate Product Name</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              A measurement for <span className="font-semibold text-[var(--text)]">{pendingMeasurementData.product}</span> already exists. Do you want to merge these new measurements with the existing one, or save this as a new record?
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 w-full shadow-lg shadow-[var(--accent)]/20"
                onClick={handleMergeMeasurement}
              >
                Merge with existing
              </button>
              <button
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--soft)] w-full"
                onClick={handleRecordAsNew}
              >
                Record as new
              </button>
              <button
                className="mt-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)] w-full py-1"
                onClick={() => {
                  setShowMergePopup(false);
                  setPendingMeasurementData(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:underline"
          onClick={() => {
            if (isAddingMeasurement) {
              setIsAddingMeasurement(false)
                    setPhotoFile(null)
            } else if (isEditingClient) {
              setIsEditingClient(false)
              if (setClientDetailMode) setClientDetailMode('view')
                    setPhotoFile(null)
            } else {
              setCurrentPage('view-clients')
            }
          }}
        >
          <ChevronLeft size={16} /> {isAddingMeasurement ? 'Cancel Adding' : isEditingClient ? 'Cancel Editing' : 'Back to Clients'}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-80 z-20 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--soft)] flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 group w-full text-left"
            onClick={() => {
              setShowClientDropdown(!showClientDropdown)
              setClientSearch('')
            }}
          >
            <h1 className="text-3xl font-semibold hover:text-[var(--accent)] transition-colors truncate flex-1">{client.name || 'New Client'}</h1>
            <ChevronDown size={24} className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-transform" style={{ transform: showClientDropdown ? 'rotate(180deg)' : '' }} />
          </button>
          <p className="mt-2 text-sm text-[var(--muted)]">Client details and measurements</p>

          {showClientDropdown && (
            <div className="absolute top-full mt-2 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-2xl backdrop-blur">
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search client or add new..."
                  className="w-full rounded-xl border border-[var(--border)] bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
                {clientsList.filter(c => (c.name?.toString() || '').toLowerCase().includes((clientSearch || '').toLowerCase()) || (c.mobile?.toString() || '').includes(clientSearch)).map(c => (
                  <button
                    key={c.id || c.mobile}
                    className="w-full rounded-xl px-4 py-3 text-left text-sm transition hover:bg-[var(--soft)] flex justify-between items-center"
                    onClick={() => {
                      setSelectedClient(c)
                      setSelectedMeasurementIndex(0)
                      setShowClientDropdown(false)
                      if (setClientDetailMode) setClientDetailMode('view')
                    setPhotoFile(null)
                      setIsEditingClient(false)
                      setIsAddingMeasurement(false)
                    setPhotoFile(null)
                    }}
                  >
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-[var(--muted)]">{c.mobile || 'No mobile'}</p>
                    </div>
                    {c.id === client.id && <span className="h-2 w-2 rounded-full bg-[var(--accent)]"></span>}
                  </button>
                ))}
                {clientSearch && clientsList.filter(c => (c.name?.toString() || '').toLowerCase().includes((clientSearch || '').toLowerCase())).length === 0 && (
                  <button
                    className="flex w-full items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-left text-sm font-semibold text-[var(--accent)] transition hover:brightness-95"
                    onClick={() => {
                      const newClient = {
                        id: Date.now(),
                        name: clientSearch,
                        mobile: '',
                        address: '',
                        measurements: [],
                        createdAt: new Date().toISOString()
                      }
                      setSelectedClient(newClient)
                      setSelectedMeasurementIndex(0)
                      setShowClientDropdown(false)
                      if (setClientDetailMode) setClientDetailMode('edit')
                      setIsEditingClient(true)
                      setIsAddingMeasurement(true)
                      setEditName(clientSearch)
                      setEditMobile('')
                      setEditAddress('')
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add "{clientSearch}" as new client
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {!isAddingMeasurement && !isEditingClient && (
          <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto">
            <button
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold transition hover:bg-[var(--soft)] flex items-center justify-center gap-2 shadow-sm active:scale-95"
              onClick={() => setIsEditingClient(true)}
            >
              <Pencil size={18} />
              Edit Profile
            </button>
            {currentUser?.role === 'Admin' && (
              <button
                className="rounded-xl border border-red-500/20 bg-red-50 text-red-600 px-4 py-3 text-sm font-bold transition hover:bg-red-600 hover:text-white flex items-center justify-center gap-2 shadow-sm active:scale-95"
                onClick={() => setClientToDelete(client)}
              >
                <Trash2 size={18} />
                Delete
              </button>
            )}
            <button
              className="col-span-2 sm:col-auto rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-95 flex items-center justify-center gap-2 active:scale-95"
              onClick={() => {
                setProduct('')
                setProductSearch('')
                setTopMeasurements(defaultTop)
                setBottomMeasurements(defaultBottom)
                setNote('')
                setSketch(null)
                setIsAddingMeasurement(true)
              }}
            >
              <Plus size={20} />
              Add Measurement
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {(!isAddingMeasurement && !isEditingClient) || isAddingMeasurement ? (
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
            <h2 className="text-h2 mb-6 flex items-center gap-2">
              <UsersRound size={20} /> Personal Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Full Name</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{client.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Mobile Number</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{client.mobile}</p>
              </div>
              <div className="sm:col-span-3">
                <p className="text-sm font-medium text-[var(--muted)]">Address</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{client.address}</p>
              </div>
            </div>
          </section>
        ) : null}

        {(!isAddingMeasurement && !isEditingClient) ? (
          <>
            {isEmptyMeasurement && (
              <section className="rounded-[24px] border border-orange-500/20 bg-orange-50/50 p-6 shadow-sm backdrop-blur mb-6">
                <p className="text-center text-orange-800 font-medium">No measurements have been recorded for this product yet.</p>
              </section>
            )}

            {/* Read-Only View */}
            {measurements.length > 1 && (
              <section className="relative z-9 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
                <h2 className="text-h2 mb-4 flex items-center gap-2">
                  <ShoppingBag size={20} /> Select Product Measurement
                </h2>
                <div className="relative">
                  <button
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-left shadow-sm transition hover:border-[var(--accent)]"
                    onClick={() => setShowMeasurementDropdown(!showMeasurementDropdown)}
                    type="button"
                  >
                    <div>
                      <span className="block text-sm font-semibold text-[var(--text)]">
                        {measurements[selectedMeasurementIndex].product || `Product ${selectedMeasurementIndex + 1}`}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        Added {formatDateDDMMYY(measurements[selectedMeasurementIndex].createdAt || client.createdAt)}{measurements[selectedMeasurementIndex].addedBy ? ` • By ${measurements[selectedMeasurementIndex].addedBy}` : ''}
                      </span>
                    </div>
                    <ChevronDown size={18} className={`text-[var(--muted)] transition-transform ${showMeasurementDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showMeasurementDropdown && (
                    <div className="absolute left-0 right-0 z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-xl shadow-black/10">
                      {measurements.map((measurement, index) => (
                        <div key={measurement.id || index} className="flex items-stretch w-full group relative">
                          <button
                            onClick={() => {
                              setSelectedMeasurementIndex(index)
                              setShowMeasurementDropdown(false)
                            }}
                            className={`flex-1 flex items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--soft)] ${selectedMeasurementIndex === index ? 'bg-[var(--soft)] border-l-4 border-[var(--accent)]' : 'border-l-4 border-transparent'
                              }`}
                            type="button"
                          >
                            <div>
                              <span className={`block text-sm font-semibold ${selectedMeasurementIndex === index ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                                {measurement.product || `Product ${index + 1}`}
                              </span>
                              <span className="block text-xs text-[var(--muted)]">
                                {formatDateDDMMYY(measurement.createdAt || client.createdAt)}{measurement.addedBy ? ` • By ${measurement.addedBy}` : ''}
                              </span>
                            </div>
                            {selectedMeasurementIndex === index && (
                              <div className="h-2 w-2 rounded-full bg-[var(--accent)] mr-8"></div>
                            )}
                          </button>
                          <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMeasurementToDelete(index);
                              setShowMeasurementDropdown(false);
                            }}
                            title="Delete Measurement"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
              <h2 className="text-h2 mb-6 flex items-center gap-2">
                <Package size={20} /> Product
              </h2>
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Product Name/Type</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{currentMeasurement.product || 'Not specified'}</p>
              </div>
            </section>

            {displayTop && (
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur overflow-hidden">
              <button 
                type="button"
                onClick={() => setShowTopAccordion(!showTopAccordion)}
                className="w-full flex items-center justify-between mb-2 group transition-all"
              >
                <h2 className="text-h2 flex items-center gap-2 group-hover:text-[var(--accent)]">
                  <Package size={20} className="text-[var(--accent)]" /> Top Measurements
                </h2>
                <div className={`grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition-transform duration-300 ${showTopAccordion ? 'rotate-180' : ''}`}>
                  <ChevronDown size={18} />
                </div>
              </button>
              
              <div className={`transition-all duration-300 ease-in-out ${showTopAccordion ? 'max-h-[4000px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                <div className="measurement-grid">
                <div className="measurement-row bg-[var(--soft)]/30">
                  <span className="measurement-label text-[var(--accent)]">Product Length</span>
                  <div className="measurement-input-group">
                    <span className="measurement-input-label">Length</span>
                    <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-bold text-[var(--text)]">
                      {currentMeasurement.topMeasurements?.length || '-'}
                    </span>
                  </div>
                  <div></div>
                </div>
                {topFields.map((field) => {
                  let lenVal = currentMeasurement.topMeasurements?.[`${field.key}Length`] || '';
                  let rndVal = currentMeasurement.topMeasurements?.[`${field.key}Round`] || '';
                  if (field.key === 'sleeveLength') {
                    lenVal = currentMeasurement.topMeasurements?.sleeveLengthLength || currentMeasurement.topMeasurements?.sleeveLength || '';
                    rndVal = currentMeasurement.topMeasurements?.sleeveLengthRound || '';
                  } else if (field.key === 'sleeveRound') {
                    lenVal = currentMeasurement.topMeasurements?.sleeveRoundLength || '';
                    rndVal = currentMeasurement.topMeasurements?.sleeveRoundRound || currentMeasurement.topMeasurements?.sleeveRound || '';
                  } else if (field.key === 'biceps') {
                    lenVal = currentMeasurement.topMeasurements?.bicepsLength || '';
                    rndVal = currentMeasurement.topMeasurements?.bicepsRound || currentMeasurement.topMeasurements?.biceps || '';
                  } else if (field.key === 'armRound') {
                    lenVal = currentMeasurement.topMeasurements?.armRoundLength || '';
                    rndVal = currentMeasurement.topMeasurements?.armRoundRound || currentMeasurement.topMeasurements?.armRound || '';
                  }

                  return (
                    <div key={field.key} className="measurement-row">
                      <span className="measurement-label">{field.label}</span>
                      <div className="measurement-input-group">
                        <span className="measurement-input-label">Length</span>
                        <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                          {lenVal || '-'}
                        </span>
                      </div>
                      <div className="measurement-input-group">
                        <span className="measurement-input-label">Round</span>
                        <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                          {rndVal || '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </section>
            )}

            {displayBottom && (
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur overflow-hidden">
              <button 
                type="button"
                onClick={() => setShowBottomAccordion(!showBottomAccordion)}
                className="w-full flex items-center justify-between mb-2 group transition-all"
              >
                <h2 className="text-h2 flex items-center gap-2 group-hover:text-[var(--accent)]">
                  <Package size={20} className="text-[var(--accent)]" /> Bottom Measurements
                </h2>
                <div className={`grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition-transform duration-300 ${showBottomAccordion ? 'rotate-180' : ''}`}>
                  <ChevronDown size={18} />
                </div>
              </button>

              <div className={`transition-all duration-300 ease-in-out ${showBottomAccordion ? 'max-h-[3000px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                <div className="measurement-grid">
                <div className="measurement-row bg-[var(--soft)]/30">
                  <span className="measurement-label text-[var(--accent)]">Product Length</span>
                  <div className="measurement-input-group">
                    <span className="measurement-input-label">Length</span>
                    <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-bold text-[var(--text)]">
                      {currentMeasurement.bottomMeasurements?.length || '-'}
                    </span>
                  </div>
                  <div></div>
                </div>
                {[
                  { key: 'waist', label: 'Waist' },
                  { key: 'hip', label: 'Hip' },
                  { key: 'thighs', label: 'Thighs' },
                  { key: 'knee', label: 'Knee' },
                  { key: 'calf', label: 'Calf' },
                  { key: 'ankle', label: 'Ankle' },
                  { key: 'crotch', label: 'Crotch' }
                ].map((field) => (
                  <div key={field.key} className="measurement-row">
                    <span className="measurement-label">{field.label}</span>
                    <div className="measurement-input-group">
                      <span className="measurement-input-label">Length</span>
                      <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                        {currentMeasurement.bottomMeasurements?.[`${field.key}Length`] || '-'}
                      </span>
                    </div>
                    <div className="measurement-input-group">
                      <span className="measurement-input-label">Round</span>
                      <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                        {currentMeasurement.bottomMeasurements?.[`${field.key}Round`] || '-'}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </section>
            )}

            {hasSketch(currentMeasurement.sketch) && (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
                <h2 className="text-h2 mb-4 flex items-center gap-2">
                  <Pencil size={20} /> Pattern Sketch
                </h2>
                <SketchBoard value={currentMeasurement.sketch} readOnly />
              </section>
            )}

            <section className="flex-1 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur mb-6">
                <h2 className="text-h2 mb-4 flex items-center gap-2">
                  <ImageIcon size={20} /> Measurement Photo
                </h2>
                {currentMeasurement.photoUrl ? (
                <div className="flex flex-col items-start gap-3">
                  <div onClick={() => setImagePopup(currentMeasurement.photoUrl)} className="block w-32 h-32 border border-[var(--border)] shadow-md rounded-lg overflow-hidden transition-transform hover:scale-105 cursor-pointer relative group">
                    <img src={currentMeasurement.photoUrl} alt="Measurement" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={handleDeletePhoto}
                    className="flex items-center gap-1 text-sm font-semibold text-red-500 hover:text-red-700 transition"
                  >
                    <Trash2 size={16} /> Delete Photo
                  </button>
                </div>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-[var(--muted)] italic">No measurement photo uploaded.</p>
                  </div>
                )}
              </section>

            {imagePopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setImagePopup(null)}>
                <img src={imagePopup} alt="Measurement Popup" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 p-2 rounded-full transition" onClick={() => setImagePopup(null)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}

            {currentMeasurement.note && (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
                <h2 className="text-h2 mb-4 flex items-center gap-2">
                  <Settings size={20} /> Notes
                </h2>
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{currentMeasurement.note}</p>
              </section>
            )}

            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Measurement Added On</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {formatDateTimeDDMMYY(currentMeasurement.createdAt || client.createdAt)}
                </p>
              </div>
            </section>
          </>
        ) : (
          <form onSubmit={handleSaveMeasurement} className="space-y-6">
            {isEditingClient && (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
                <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
                  <UsersRound size={20} /> Edit Personal Details
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--text)]">Full Name</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)]" type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--text)]">Mobile Number</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)]" type="tel" value={editMobile} onChange={e => setEditMobile(e.target.value)} required />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-[var(--text)]">Address</span>
                    <textarea className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] resize-none" rows="2" value={editAddress} onChange={e => setEditAddress(e.target.value)} required />
                  </label>
                </div>
              </section>
            )}

            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
                <Package size={20} /> {isEditingClient ? 'Edit Product Measurement' : 'Add New Measurement'}
              </h2>
              <div className="mb-6 relative">
                <label className="block">
                  <span className="text-sm font-medium text-[var(--text)]">Product</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                    type="text"
                    value={product}
                    onChange={(e) => {
                      setProduct(e.target.value)
                      setProductSearch(e.target.value)
                      setShowProductDropdown(true)
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                    placeholder="Search or type product name..."
                    required
                  />
                </label>
                {showProductDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-lg">
                    {commonProducts
                      .filter(p => p.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => (
                        <div key={p} className="flex items-center group w-full px-4 py-1 hover:bg-[var(--soft)]">
                          <button
                            className="flex-1 py-1.5 text-left text-sm text-[var(--text)] transition"
                            onClick={() => {
                              setProduct(p)
                              setProductSearch(p)
                              setShowProductDropdown(false)
                            }}
                            type="button"
                          >
                            {p}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = commonProducts.filter(item => item !== p);
                              if (setProductTypes) setProductTypes(updated);
                              if (saveConfig) saveConfig('productTypes', updated);
                              if (showGlobalToast) showGlobalToast('Removed', `Product "${p}" removed from list.`);
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    {productSearch && !commonProducts.some(p => p.toLowerCase() === productSearch.toLowerCase()) && (
                      <button
                        className="w-full px-4 py-2 text-left text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--soft)]"
                        onClick={() => {
                          const newProduct = productSearch.trim()
                          if (newProduct && !commonProducts.includes(newProduct)) {
                            const updatedProducts = [...commonProducts, newProduct]
                            if (setProductTypes) setProductTypes(updatedProducts);
                            if (saveConfig) saveConfig('productTypes', updatedProducts);
                            setProduct(newProduct)
                            setProductSearch(newProduct)
                            setShowProductDropdown(false)
                          }
                        }}
                        type="button"
                      >
                        + Add "{productSearch}"
                      </button>
                    )}
                    {commonProducts.filter(p => p.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && !productSearch && (
                      <div className="px-4 py-2 text-sm text-[var(--muted)]">No products found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Top Section */}
              {displayTop && (
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-semibold text-[var(--accent)] border-b border-[var(--border)] pb-2">Top Section</h3>
                <div className="measurement-grid">
                  <div className="measurement-row bg-[var(--soft)]/30">
                    <span className="measurement-label text-[var(--accent)]">Product Length</span>
                    <div className="measurement-input-group">
                      <span className="measurement-input-label">Length</span>
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                        type="text"
                        value={topMeasurements.length}
                        onChange={(e) => setTopMeasurements({ ...topMeasurements, length: e.target.value })}
                        placeholder="Length" inputMode="decimal"
                      />
                    </div>
                    <div></div>
                  </div>
                  {topFields.map((field) => {
                    let lenVal = topMeasurements[`${field.key}Length`] || '';
                    let rndVal = topMeasurements[`${field.key}Round`] || '';
                    if (field.key === 'sleeveLength') {
                      lenVal = topMeasurements.sleeveLengthLength || topMeasurements.sleeveLength || '';
                      rndVal = topMeasurements.sleeveLengthRound || '';
                    } else if (field.key === 'sleeveRound') {
                      lenVal = topMeasurements.sleeveRoundLength || '';
                      rndVal = topMeasurements.sleeveRoundRound || topMeasurements.sleeveRound || '';
                    } else if (field.key === 'biceps') {
                      lenVal = topMeasurements.bicepsLength || '';
                      rndVal = topMeasurements.bicepsRound || topMeasurements.biceps || '';
                    } else if (field.key === 'armRound') {
                      lenVal = topMeasurements.armRoundLength || '';
                      rndVal = topMeasurements.armRoundRound || topMeasurements.armRound || '';
                    }

                    return (
                      <div key={field.key} className="measurement-row">
                        <span className="measurement-label">{field.label}</span>
                        <div className="measurement-input-group">
                          <span className="measurement-input-label">Length</span>
                          <input
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                            type="text"
                            value={lenVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (field.key === 'sleeveLength') {
                                setTopMeasurements({ ...topMeasurements, sleeveLengthLength: val, sleeveLength: val });
                              } else if (field.key === 'sleeveRound') {
                                setTopMeasurements({ ...topMeasurements, sleeveRoundLength: val });
                              } else if (field.key === 'biceps') {
                                setTopMeasurements({ ...topMeasurements, bicepsLength: val });
                              } else if (field.key === 'armRound') {
                                setTopMeasurements({ ...topMeasurements, armRoundLength: val });
                              } else {
                                setTopMeasurements({ ...topMeasurements, [`${field.key}Length`]: val });
                              }
                            }}
                            placeholder="Length" inputMode="decimal"
                          />
                        </div>
                        <div className="measurement-input-group">
                          <span className="measurement-input-label">Round</span>
                          <input
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                            type="text"
                            value={rndVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (field.key === 'sleeveLength') {
                                setTopMeasurements({ ...topMeasurements, sleeveLengthRound: val });
                              } else if (field.key === 'sleeveRound') {
                                setTopMeasurements({ ...topMeasurements, sleeveRoundRound: val, sleeveRound: val });
                              } else if (field.key === 'biceps') {
                                setTopMeasurements({ ...topMeasurements, bicepsRound: val, biceps: val });
                              } else if (field.key === 'armRound') {
                                setTopMeasurements({ ...topMeasurements, armRoundRound: val, armRound: val });
                              } else {
                                setTopMeasurements({ ...topMeasurements, [`${field.key}Round`]: val });
                              }
                            }}
                            placeholder="Round" inputMode="decimal"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Bottom Section */}
              {displayBottom && (
              <div>
                <h3 className="mb-4 text-lg font-semibold text-[var(--accent)] border-b border-[var(--border)] pb-2">Bottom Section</h3>
                <div className="measurement-grid">
                  <div className="measurement-row bg-[var(--soft)]/30">
                    <span className="measurement-label text-[var(--accent)]">Product Length</span>
                    <div className="measurement-input-group">
                      <span className="measurement-input-label">Length</span>
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                        type="text"
                        value={bottomMeasurements.length}
                        onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, length: e.target.value })}
                        placeholder="Length" inputMode="decimal"
                      />
                    </div>
                    <div></div>
                  </div>
                  {[
                    { key: 'waist', label: 'Waist' },
                    { key: 'hip', label: 'Hip' },
                    { key: 'thighs', label: 'Thighs' },
                    { key: 'knee', label: 'Knee' },
                    { key: 'calf', label: 'Calf' },
                    { key: 'ankle', label: 'Ankle' },
                    { key: 'crotch', label: 'Crotch' }
                  ].map((field) => (
                    <div key={field.key} className="measurement-row">
                      <span className="measurement-label">{field.label}</span>
                      <div className="measurement-input-group">
                        <span className="measurement-input-label">Length</span>
                        <input
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                          type="text"
                          value={bottomMeasurements[`${field.key}Length`] || ''}
                          onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, [`${field.key}Length`]: e.target.value })}
                          placeholder="Length" inputMode="decimal"
                        />
                      </div>
                      <div className="measurement-input-group">
                        <span className="measurement-input-label">Round</span>
                        <input
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                          type="text"
                          value={bottomMeasurements[`${field.key}Round`] || ''}
                          onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, [`${field.key}Round`]: e.target.value })}
                          placeholder="Round" inputMode="decimal"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </section>

            {/* Pattern Sketch Section */}
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
              <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold">
                <Pencil size={20} /> Pattern Sketch
              </h2>
              <p className="mb-4 text-xs text-[var(--muted)]">
                Sketch the pattern / design reference on the board. Saved as a tiny vector, no image upload.
              </p>
              <SketchBoard value={sketch} onChange={setSketch} />
            </section>

            {/* Photo Upload Section */}
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <ImageIcon size={20} /> Measurement Photo
              </h2>
              <div className="relative group">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-strong)] transition-all group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)]/5">
                {photoFile ? (
                   <div className="flex flex-col items-center gap-2">
                     <img src={URL.createObjectURL(photoFile)} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-[var(--border)] shadow-sm" />
                     <button type="button" onClick={() => setPhotoFile(null)} className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition z-10 relative">Remove</button>
                   </div>
                ) : isEditingClient && !isAddingMeasurement && client.measurements?.[selectedMeasurementIndex]?.photoUrl ? (
                   <div className="flex flex-col items-center gap-2">
                     <img src={client.measurements[selectedMeasurementIndex].photoUrl} alt="Existing" className="h-20 w-20 object-cover rounded-lg border border-[var(--border)] shadow-sm" />
                     <button type="button" onClick={() => {
                          const newMeasurements = [...client.measurements];
                          newMeasurements[selectedMeasurementIndex].photoUrl = null;
                          saveClientAndClose({...client, measurements: newMeasurements}, selectedMeasurementIndex, false, true);
                     }} className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition z-10 relative">Remove Existing</button>
                   </div>
                ) : (
                  <>
                    <ImageIcon size={24} className="text-[var(--muted)] mb-2 group-hover:text-[var(--accent)] transition-colors" />
                    <span className="text-sm font-medium text-[var(--text)]">Click to upload photo</span>
                    <span className="text-xs text-[var(--muted)] mt-1">JPEG, PNG, WebP</span>
                  </>
                )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPhotoFile(e.target.files[0])
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                />
              </div>
            </section>

            {/* Note Section */}
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <Settings size={20} /> Notes
              </h2>
              <label className="block">
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 resize-none"
                  rows="4"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add any additional notes for this measurement..."
                />
              </label>
            </section>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full mt-6">
              <button
                className="w-full sm:w-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-6 py-3 font-semibold transition hover:bg-[var(--soft)] cursor-pointer text-center justify-center flex items-center"
                type="button"
                onClick={() => {
                  if (isEditingClient) {
                    setIsEditingClient(false)
                    if (setClientDetailMode) setClientDetailMode('view')
                    setPhotoFile(null)
                  } else {
                    setIsAddingMeasurement(false)
                    setPhotoFile(null)
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="w-full sm:w-auto rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--accent)]/25 transition hover:brightness-95 cursor-pointer text-center justify-center flex items-center"
                type="submit"
              >
                {isUploading ? "Saving..." : (isEditingClient ? 'Update Measurement' : 'Save Measurement')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ClientDetailPage;
