import React, { useState } from 'react'
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react'

export default function CameraOnboardingModal({
  isOpen,
  onClose,
  departmentId,
  departments,
  onUploadCsv,
  importReport,
  onCreateCamera,
}) {
  const [activeTab, setActiveTab] = useState('csv')
  const [selectedDept, setSelectedDept] = useState(departmentId || departments?.[0]?.id || 1)
  
  // Manual Form State
  const [name, setName] = useState('')
  const [lat, setLat] = useState('23.2156')
  const [lon, setLon] = useState('72.6369')
  const [vendor, setVendor] = useState('Hikvision')
  const [model, setModel] = useState('DS-2CD2043G2')
  const [rtspUrl, setRtspUrl] = useState('rtsp://10.20.1.150:554/live')
  const [retention, setRetention] = useState('30')
  const [manualSuccess, setManualSuccess] = useState(false)

  if (!isOpen) return null

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!name) return
    try {
      await onCreateCamera({
        department_id: Number(selectedDept),
        name,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        vendor,
        model,
        rtsp_url: rtspUrl,
        retention_days: parseInt(retention, 10),
      })
      setManualSuccess(true)
      setTimeout(() => {
        setManualSuccess(false)
        onClose()
      }, 1200)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg glass-panel rounded-2xl overflow-hidden shadow-2xl border-slate-700/80 flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Onboard Surveillance Cameras
              </h3>
              <p className="text-[11px] text-slate-400">
                Model 1 Bulk Ingestion & Asset Registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/30 text-xs font-medium px-4 pt-2">
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'csv'
                ? 'border-cyan-500 text-cyan-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV Bulk Importer</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-cyan-500 text-cyan-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Registration</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {activeTab === 'csv' ? (
            <div className="space-y-4">
              {/* Department Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(Number(e.target.value))}
                  className="w-full py-2 px-3 rounded-xl text-xs glass-input"
                >
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <div className="relative border-2 border-dashed border-slate-700 hover:border-cyan-500/80 rounded-2xl p-6 text-center bg-slate-950/40 transition group cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => onUploadCsv(selectedDept, e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Click to upload or drag & drop CSV
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Required columns: <code>name</code>, <code>lat</code>, <code>lon</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Ingestion Report Feedback */}
              {importReport && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Imported {importReport.inserted} cameras successfully</span>
                  </div>
                  {importReport.errors?.length > 0 && (
                    <div className="space-y-1 text-rose-300 text-[11px]">
                      <div className="font-medium text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{importReport.errors.length} rows rejected (savepoint protected):</span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {importReport.errors.map(([line, msg], i) => (
                          <div key={i} className="font-mono text-[10px] text-slate-400">
                            Line {line}: {msg}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Manual Registration Form */
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(Number(e.target.value))}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs glass-input"
                  >
                    {(departments || []).map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Vendor</label>
                  <input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs glass-input"
                    placeholder="e.g. Hikvision"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Camera Location Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl text-xs glass-input"
                  placeholder="e.g. Gandhinagar Highway Junction"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono glass-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono glass-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">RTSP Stream URL</label>
                <input
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono glass-input"
                  placeholder="rtsp://10.20.1.1:554/live"
                />
              </div>

              {manualSuccess && (
                <div className="p-2 rounded-xl bg-emerald-950/80 text-emerald-300 text-xs flex items-center gap-1.5 border border-emerald-500/40">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Camera registered successfully!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg"
              >
                Register Camera
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
