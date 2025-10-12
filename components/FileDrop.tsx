'use client'

import { FilePond, registerPlugin } from 'react-filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginFileValidateSize from 'filepond-plugin-file-validate-size'
import { useState } from 'react'

registerPlugin(FilePondPluginFileValidateType, FilePondPluginFileValidateSize)

export default function FileDrop({ onFile }:{ onFile:(f:File|null)=>void }) {
  const [files, setFiles] = useState<any[]>([])

  return (
    <div className="space-y-3">
      <div className="filepond-shell">
        <FilePond
          files={files}
          onupdatefiles={fileItems => {
            setFiles(fileItems)
            const f = (fileItems[0]?.file ?? null) as File | null
            onFile(f)
          }}
          allowMultiple={false}
          maxFiles={1}
          allowFileTypeValidation
          acceptedFileTypes={['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']}
          allowFileSizeValidation
          maxFileSize="10MB"
          credits={false}
          stylePanelLayout="integrated"
          labelIdle='<span class="filepond-shell__icon">⬆️</span><span class="filepond-shell__headline">Drop your resume here or <span class="filepond--label-action">browse</span></span><span class="filepond-shell__subhead">DOCX or text-based PDF · under 10 MB</span>'
        />
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs leading-relaxed text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <div><strong className="font-semibold text-slate-700 dark:text-slate-100">Reminder:</strong> Avoid scanned images—export from Word, Google Docs, or your ATS as a clean PDF or DOCX so we can parse every line.</div>
      </div>
    </div>
  )
}
