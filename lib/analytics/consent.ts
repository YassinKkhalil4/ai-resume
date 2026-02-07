'use client'

const CONSENT_COOKIE = 'analytics_consent'
const CONSENT_STORAGE_KEY = 'analytics_consent'

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check cookie first
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')[1]
  
  if (cookieValue === 'true') return true
  
  // Fallback to localStorage
  const storageValue = localStorage.getItem(CONSENT_STORAGE_KEY)
  return storageValue === 'true'
}

export function setAnalyticsConsent(consented: boolean): void {
  if (typeof window === 'undefined') return
  
  // Set cookie (expires in 1 year)
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${CONSENT_COOKIE}=${consented}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
  
  // Also set in localStorage as backup
  localStorage.setItem(CONSENT_STORAGE_KEY, String(consented))
}

export function getConsentStatus(): 'granted' | 'denied' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')[1]
  
  if (cookieValue === 'true') return 'granted'
  if (cookieValue === 'false') return 'denied'
  
  const storageValue = localStorage.getItem(CONSENT_STORAGE_KEY)
  if (storageValue === 'true') return 'granted'
  if (storageValue === 'false') return 'denied'
  
  return 'unknown'
}
