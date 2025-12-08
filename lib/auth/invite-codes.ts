import { getConfig } from '../config'

export function isValidInviteCode(code: string): boolean {
  const config = getConfig()
  const validCodes = config.invites || []
  return validCodes.includes(code)
}

export function validateInviteCode(code: string | null | undefined): {
  valid: boolean
  message?: string
} {
  if (!code) {
    return { valid: true } // Invite code is optional
  }

  if (isValidInviteCode(code)) {
    return { valid: true }
  }

  return { valid: false, message: 'Invalid invite code' }
}

