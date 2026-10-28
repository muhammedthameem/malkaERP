import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Package, Search, Settings, UsersRound, Trash2, Image as ImageIcon, List } from 'lucide-react'
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

function AddClientsPage({ themeStyle, setCurrentPage, showGlobalToast, clients, setClients, saveClient, currentUser, productTypes = [], setProductTypes, saveConfig }) {
  const [personalDetails, setPersonalDetails] = useState(() => {
    const prefill = localStorage.getItem('prefillClientName')
    if (prefill) {
      localStorage.removeItem('prefillClientName')
      return { name: prefill, address: '', mobile: '' }
    }
    return { name: '', address: '', mobile: '' }
  })
  const [showTopMeasurements, setShowTopMeasurements] = useState(true)
  const [showBottomMeasurements, setShowBottomMeasurements] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [product, setProduct] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const commonProducts = productTypes.length > 0 ? productTypes : [
    'Shirt', 'T-Shirt', 'Blouse', 'Kurta', 'Pants', 'Jeans', 'Trousers', 'Dress', 'Saree', 
    'Salwar Kameez', 'Lehenga', 'Blazer', 'Suit', 'Jacket', 'Coat', 'Skirt', 'Shorts', 
    'Sweater', 'Cardigan', 'Anarkali'
  ]
  const [topMeasurements, setTopMeasurements] = useState({
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
  })
  const [bottomMeasurements, setBottomMeasurements] = useState({
    length: '',
    waistLength: '',
    waistRound: '',
    hipLength: '',
    hipRound: '',
    thighsLength: '',
    thighsRound: '',
    kneeLength: '',
    kneeRound: '',
    calfLength: '',
    calfRound: '',
    ankleLength: '',
    ankleRound: '',
    crotchLength: '',
    crotchRound: ''
  })
  const [note, setNote] = useState('')
  const [sketch, setSketch] = useState(null)

  // Safety check for non-admin or uninitialized users
  if (!clients) return <div className="p-10 text-center">Loading clients...</div>;

  const handleCancel = () => {
    const hasData = 
      personalDetails.name || 
      personalDetails.address || 
      personalDetails.mobile || 
      product || 
      note || 
      photoFile ||
      hasSketch(sketch);

    if (hasData) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel and discard them?')) {
        setCurrentPage('view-clients');
      }
    } else {
      setCurrentPage('view-clients');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault()

    // --- FORM VALIDATION ---
    if (!personalDetails.name.trim()) {
      if (showGlobalToast) showGlobalToast('Name Required', 'Please enter the client name before saving.');
      return;
    }
    if (!personalDetails.mobile.trim()) {
      if (showGlobalToast) showGlobalToast('Mobile Required', 'Please enter a mobile number for the client.');
      return;
    }
    if (!product.trim()) {
      if (showGlobalToast) showGlobalToast('Product Missing', 'Please specify a product for the measurements.');
      return;
    }

    let photoUrl = null;
    if (photoFile) {
      setIsUploading(true);
      try {
        const compressedPhoto = await compressImage(photoFile);
        const fileExt = compressedPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error } = await supabase.storage
          .from('measurements')
          .upload(fileName, compressedPhoto);
          
        if (error) throw error;
        
        const { data } = supabase.storage
          .from('measurements')
          .getPublicUrl(fileName);
          
        photoUrl = data.publicUrl;
      } catch (err) {
        console.error('Error uploading photo:', err);
        try {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(photoFile);
          });
          photoUrl = base64;
          if (showGlobalToast) showGlobalToast('Storage Upload Failed', 'Falling back to local database storage for image.');
        } catch (b64Err) {
          if (showGlobalToast) showGlobalToast('Upload Failed', err.message || 'Could not upload measurement photo.');
        }
      } finally {
        setIsUploading(false);
      }
    }

    const measurementData = {
      id: Date.now(),
      product,
      topMeasurements,
      bottomMeasurements,
      note,
      sketch,
      photoUrl,
      createdAt: new Date().toISOString()
    }

    const existingClients = [...clients]
    const existingClientIndex = existingClients.findIndex(c => 
      c.mobile === personalDetails.mobile && 
      (c.name || '').trim().toLowerCase() === (personalDetails.name || '').trim().toLowerCase()
    )

    if (existingClientIndex >= 0) {
      if (showGlobalToast) showGlobalToast('Duplicate Client', `A client with the name "${personalDetails.name}" and mobile "${personalDetails.mobile}" already exists.`);
      return;
    }
    
    const clientData = {
      id: Date.now(),
      ...personalDetails,
      measurements: [measurementData],
      createdAt: new Date().toISOString()
    }
    setClients([...existingClients, clientData])
    if (saveClient) saveClient(clientData);

    console.log('Client data saved:', measurementData)
    if (showGlobalToast) showGlobalToast('Client Added', `Client "${personalDetails.name}" added successfully.`)

    if (isConverting) {
      localStorage.setItem('prefillOrderClientName', personalDetails.name)
      localStorage.setItem('prefillOrderProduct', product)
      setCurrentPage('add-order')
      setIsConverting(false)
    } else {
      setCurrentPage('view-clients')
    }

    setPersonalDetails({ name: '', address: '', mobile: '' })
    setProduct('')
    setTopMeasurements({
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
    })
    setBottomMeasurements({
      length: '',
      waistLength: '', waistRound: '',
      hipLength: '', hipRound: '',
      thighsLength: '', thighsRound: '',
      kneeLength: '', kneeRound: '',
      calfLength: '', calfRound: '',
      ankleLength: '', ankleRound: '',
      crotchLength: '', crotchRound: ''
    })
    setNote('')
    setSketch(null)
    setPhotoFile(null)
  }

  return (
    <div style={themeStyle} className="relative">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-h1">Add New Client</h1>
          <p className="text-para text-[var(--muted)] mt-2">Enter client personal details and measurements</p>
        </div>
        <button
          onClick={() => setCurrentPage('view-clients')}
          className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--accent)]/25 transition hover:brightness-95 cursor-pointer flex items-center gap-2 shrink-0"
        >
          <List size={20} />
          View Clients
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details Section */}
        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <h2 className="text-h2 mb-6 flex items-center gap-2">
            <UsersRound size={20} /> Personal Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-[var(--text)]">Full Name</span>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                type="text"
                value={personalDetails.name}
                onChange={(e) => setPersonalDetails({ ...personalDetails, name: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text)]">Mobile Number</span>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                type="tel"
                value={personalDetails.mobile}
                onChange={(e) => setPersonalDetails({ ...personalDetails, mobile: e.target.value })}
                required
              />
            </label>
            <label className="block sm:col-span-3">
              <span className="text-sm font-medium text-[var(--text)]">Address</span>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                type="text"
                value={personalDetails.address}
                onChange={(e) => setPersonalDetails({ ...personalDetails, address: e.target.value })}
                required
              />
            </label>
          </div>
        </section>

        {/* Measurements Section */}
        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow)] backdrop-blur">
          <h2 className="text-h2 mb-6 flex items-center gap-2">
            <Package size={20} /> Measurements
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
          <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-[var(--surface)] px-6 py-4 transition hover:bg-[var(--soft)]"
              onClick={() => setShowTopMeasurements(!showTopMeasurements)}
            >
              <h3 className="text-lg font-semibold text-[var(--accent)]">Top Section</h3>
              <ChevronDown size={20} className={`text-[var(--muted)] transition-transform ${showTopMeasurements ? 'rotate-180' : ''}`} />
            </button>
            {showTopMeasurements && (
              <div className="p-3 sm:p-6 pt-2 border-t border-[var(--border)]">
                <div className="measurement-grid">
                  <div className="measurement-row">
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
          </div>

          {/* Bottom Section */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-[var(--surface)] px-6 py-4 transition hover:bg-[var(--soft)]"
              onClick={() => setShowBottomMeasurements(!showBottomMeasurements)}
            >
              <h3 className="text-lg font-semibold text-[var(--accent)]">Bottom Section</h3>
              <ChevronDown size={20} className={`text-[var(--muted)] transition-transform ${showBottomMeasurements ? 'rotate-180' : ''}`} />
            </button>
            {showBottomMeasurements && (
              <div className="p-3 sm:p-6 pt-2 border-t border-[var(--border)]">
                <div className="measurement-grid">
                  <div className="measurement-row">
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
                          value={bottomMeasurements[`${field.key}Length`]}
                          onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, [`${field.key}Length`]: e.target.value })}
                          placeholder="Length" inputMode="decimal"
                        />
                      </div>
                      <div className="measurement-input-group">
                        <span className="measurement-input-label">Round</span>
                        <input
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center outline-none transition focus:border-[var(--accent)]"
                          type="text"
                          value={bottomMeasurements[`${field.key}Round`]}
                          onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, [`${field.key}Round`]: e.target.value })}
                          placeholder="Round" inputMode="decimal"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Pattern Sketch Section */}
        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <h2 className="mb-1 text-xl font-semibold">Pattern Sketch</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Sketch the pattern / design reference on the board. Saved as a tiny vector, no image upload.
          </p>
          <SketchBoard value={sketch} onChange={setSketch} />
        </section>

        {/* Note & Photo Section */}
        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <Settings size={20} /> Notes
              </h2>
              <label className="block">
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 resize-none"
                  rows="4"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add any additional notes about the client..."
                />
              </label>
            </div>
            <div className="flex-1">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <ImageIcon size={20} /> Measurement Photo
              </h2>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-xl p-4 h-[120px] bg-[var(--surface-strong)] relative">
                {photoFile ? (
                   <div className="flex flex-col items-center gap-2">
                     <img src={URL.createObjectURL(photoFile)} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-[var(--border)] shadow-sm" />
                     <button type="button" onClick={() => setPhotoFile(null)} className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition">Remove</button>
                   </div>
                ) : (
                  <>
                    <ImageIcon size={32} className="text-[var(--muted)] mb-2" />
                    <span className="text-sm text-[var(--muted)]">Click to upload photo</span>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPhotoFile(e.target.files[0])
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full mt-8">
          <button
            className="w-full sm:w-auto rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-6 py-3 font-semibold transition hover:bg-[var(--soft)] cursor-pointer text-center justify-center flex items-center"
            type="button"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="w-full sm:w-auto rounded-xl border-2 border-[var(--accent)] bg-transparent text-[var(--accent)] px-6 py-3 font-semibold shadow-lg shadow-[var(--accent)]/10 transition hover:bg-[var(--accent-soft)] cursor-pointer text-center justify-center flex items-center"
            type="submit"
            onClick={() => setIsConverting(true)}
          >
            Convert to Order
          </button>
          <button
            className="w-full sm:w-auto rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--accent)]/25 transition hover:brightness-95 cursor-pointer text-center justify-center flex items-center disabled:opacity-50"
            type="submit"
            disabled={isUploading}
            onClick={() => setIsConverting(false)}
          >
            {isUploading ? "Saving..." : "Save Client"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddClientsPage;
