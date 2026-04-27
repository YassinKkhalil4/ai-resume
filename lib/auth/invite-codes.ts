import { getConfig } from '../config'

export async function isValidInviteCode(code: string): Promise<boolean> {
  const config = await getConfig()
  const validCodes = config.invites || []
  return validCodes.includes(code)
}

export async function validateInviteCode(code: string | null | undefined): Promise<{
  valid: boolean
  message?: string
}> {
  if (!code) {
    return { valid: true } // Invite code is optional
  }

  if (await isValidInviteCode(code)) {
    return { valid: true }
  }

  return { valid: false, message: 'Invalid invite code' }
}
