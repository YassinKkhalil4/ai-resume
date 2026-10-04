export const PASSWORD_MIN_LENGTH = 8
/** bcrypt ignores everything after 72 bytes, so longer passwords would silently weaken. */
export const PASSWORD_MAX_BYTES = 72

export type PasswordCheck = { ok: true } | { ok: false; message: string }

export function validatePassword(password: unknown): PasswordCheck {
  if (typeof password !== 'string') {
    return { ok: false, message: 'Password is required' }
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` }
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return { ok: false, message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes long` }
  }
  return { ok: true }
}
