import { NextRequest, NextResponse } from 'next/server'
import { db, contactMessages } from '../../../lib/db'
import { getCurrentUser } from '../../../lib/auth/utils'

const VALID_SUBJECTS = ['support', 'feedback', 'billing', 'feature', 'other']

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, subject, message } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Name, email, subject, and message are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { code: 'invalid_email', message: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate subject is one of the allowed values
    if (!VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { code: 'invalid_subject', message: `Subject must be one of: ${VALID_SUBJECTS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get userId from session if user is authenticated (optional)
    let userId: string | undefined
    try {
      const user = await getCurrentUser()
      userId = user?.id
    } catch {
      // Not authenticated, continue as guest
    }

    // Insert message into database
    const [newMessage] = await db
      .insert(contactMessages)
      .values({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject,
        message: message.trim(),
        userId: userId || null,
        status: 'new',
      })
      .returning()

    return NextResponse.json({
      success: true,
      messageId: newMessage.id,
      message: 'Your message has been sent successfully. We will get back to you soon!',
    })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}

