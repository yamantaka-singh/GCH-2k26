import React, { useState } from 'react'
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  AlertCircle,
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg titanium-glass rounded-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] text-white border border-white/[0.08]">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">
                Onboard Surveillance Nodes
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Model 1 Multi-Department Camera Registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-white/[0.06] bg-white/[0.01] text-xs font-mono px-4 pt-2">
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 uppercase cursor-pointer ${
              activeTab === 'csv'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV Batch Ingest</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 uppercase cursor-pointer ${
              activeTab === 'manual'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
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
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Target Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(Number(e.target.value))}
                  className="w-full py-2 px-3 rounded-xl text-xs titanium-input"
                >
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#0e1219] text-white">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <div className="relative border border-dashed border-white/[0.15] hover:border-white/[0.35] rounded-2xl p-6 text-center bg-white/[0.01] transition group cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => onUploadCsv(selectedDept, e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white transition">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      Click to upload or drag & drop CSV
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Required schema: <code>name</code>, <code>lat</code>, <code>lon</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Ingestion Report Feedback */}
              {importReport && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-400 font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Imported {importReport.inserted} cameras successfully</span>
                  </div>
                  {importReport.errors?.length > 0 && (
                    <div className="space-y-1 text-rose-300 text-[11px]">
                      <div className="font-medium text-amber-400 flex items-center gap-1 font-mono">
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
                  <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(Number(e.target.value))}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs titanium-input"
                  >
                    {(departments || []).map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0e1219] text-white">
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">Vendor</label>
                  <input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs titanium-input"
                    placeholder="e.g. Hikvision"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">Camera Location Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl text-xs titanium-input"
                  placeholder="e.g. Gandhinagar Highway Junction"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono titanium-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono titanium-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">RTSP Stream URL</label>
                <input
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl text-xs font-mono titanium-input"
                  placeholder="rtsp://10.20.1.1:554/live"
                />
              </div>

              {manualSuccess && (
                <div className="p-2 rounded-xl bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-1.5 border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Camera registered successfully!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition shadow cursor-pointer active:scale-[0.99]"
              >
                Register Camera Node
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
