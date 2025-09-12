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
      labelIdle='Drag & Drop your resume or <span class="filepond--label-action">Browse</span>'
      className="border rounded-md"
    />
  )
}
