'use client'

import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { FILE_ACCEPT, SUPPORTED_FILE_TYPES_LABEL } from '@/lib/uploadConfig'
import { FileRole } from '@/types'

interface FileDropzoneProps {
  role: FileRole
  label: string
  description: string
  onFile: (file: File) => void
  selectedFile: File | null
  isLoading: boolean
}

export function FileDropzone({
  role,
  label,
  description,
  onFile,
  selectedFile,
  isLoading,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  const isCharges = role === 'charges'
  const accentColor = isCharges ? 'text-blue-600' : 'text-violet-600'
  const badgeBg = isCharges ? 'bg-blue-500/10 text-blue-700' : 'bg-violet-500/10 text-violet-700'
  const dragBorder = isCharges ? 'border-blue-400/60' : 'border-violet-400/60'
  const dragBg = isCharges ? 'bg-blue-500/5' : 'bg-violet-500/5'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', badgeBg)}>
          {isCharges ? 'CHARGES' : 'INVOICES'}
        </span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>

      {selectedFile ? (
        <div className={cn('glass flex items-center gap-3 p-4 rounded-xl border-2', isCharges ? 'border-blue-400/40' : 'border-violet-400/40')}>
          <FileSpreadsheet className={cn('w-7 h-7 flex-shrink-0', accentColor)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
          </div>
          {!isLoading && (
            <button
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                onFile(null as unknown as File)
              }}
              className="p-1 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isLoading && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'glass flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            isDragging
              ? cn(dragBorder, dragBg)
              : 'border-white/60 hover:border-white/80 hover:bg-white/70'
          )}
        >
          <Upload className={cn('w-7 h-7', isDragging ? accentColor : 'text-gray-400')} />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Drop file here or <span className={cn('font-semibold', accentColor)}>browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
            <p className="text-xs text-gray-400">{SUPPORTED_FILE_TYPES_LABEL}</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
