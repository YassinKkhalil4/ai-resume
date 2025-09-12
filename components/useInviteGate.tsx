'use client'
import { useEffect, useState } from 'react'

export default function useInviteGate() {
  const [ok, setOk] = useState(false)
  const [code, setCode] = useState('')
  useEffect(()=>{
    const has = document.cookie.includes('invite=')
    setOk(has)
  },[])
  function submit() {
    if (!code) return
    document.cookie = `invite=${encodeURIComponent(code)}; path=/; max-age=2592000`
    setOk(true)
  }
  return { ok, code, setCode, submit }
}
