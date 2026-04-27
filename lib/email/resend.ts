import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@tailora.ai'
const VERIFICATION_BASE_URL = process.env.VERIFICATION_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function sendVerificationCode(email: string, code: string) {
  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your tailora email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Thanks for signing up for tailora! Please use the verification code below to verify your email address:</p>
              <div style="background: #f3f4f6; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; font-family: 'Courier New', monospace;">${code}</div>
              </div>
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code will expire in 24 hours.</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">If you didn't create an account with tailora, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
              <p>© ${new Date().getFullYear()} tailora. Built for honest professionals.</p>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(`Failed to send verification email: ${error.message}`)
    }

    return { success: true, id: data?.id }
  } catch (error) {
    console.error('Error sending verification code email:', error)
    throw error
  }
}

export async function sendVerificationLink(email: string, token: string) {
  const verificationUrl = `${VERIFICATION_BASE_URL}/verify?token=${token}`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your tailora email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Thanks for signing up for tailora! Click the button below to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
              </div>
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #3b82f6; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This link will expire in 24 hours.</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">If you didn't create an account with tailora, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
              <p>© ${new Date().getFullYear()} tailora. Built for honest professionals.</p>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(`Failed to send verification email: ${error.message}`)
    }

    return { success: true, id: data?.id }
  } catch (error) {
    console.error('Error sending verification link email:', error)
    throw error
  }
}

export async function sendVerificationResend(email: string, code: string, token: string) {
  const verificationUrl = `${VERIFICATION_BASE_URL}/verify?token=${token}`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your tailora email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Thanks for signing up for tailora! You can verify your email address using either method below:</p>
              
              <div style="background: #f3f4f6; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">Verification Code:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; font-family: 'Courier New', monospace;">${code}</div>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">Or click this button:</p>
                <a href="${verificationUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code and link will expire in 24 hours.</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">If you didn't create an account with tailora, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
              <p>© ${new Date().getFullYear()} tailora. Built for honest professionals.</p>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(`Failed to send verification email: ${error.message}`)
    }
    return { success: true, id: data?.id }
  } catch (error) {
    console.error('Error sending verification email:', error)
    throw error
  }
}

