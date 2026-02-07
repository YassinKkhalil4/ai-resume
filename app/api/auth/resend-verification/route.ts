import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth/utils'
import { generateVerificationToken } from '../../../../lib/auth/verification'
import { sendVerificationResend } from '../../../../lib/email/resend'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'You must be logged in to resend verification email' },
        { status: 401 }
      )
    }

    // Check if already verified
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    })

    if (dbUser?.emailVerified) {
      return NextResponse.json(
        { code: 'already_verified', message: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate both code and link tokens
    // Note: generateVerificationToken deletes existing tokens, so we need to generate them separately
    // First generate code token
    const codeResult = await generateVerificationToken(user.id, 'code')
    // Then generate link token (this won't delete the code token since they're separate records)
    const linkResult = await generateVerificationToken(user.id, 'link')

    // Send email with both options
    if (codeResult.code && linkResult.token) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/resend-verification/route.ts:before-send',message:'About to send verification email',data:{email:dbUser?.email || user.email,hasCode:!!codeResult.code,hasToken:!!linkResult.token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      try {
        await sendVerificationResend(
          dbUser?.email || user.email || '',
          codeResult.code,
          linkResult.token
        )
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/resend-verification/route.ts:after-send',message:'Verification email sent successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (emailError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/resend-verification/route.ts:send-error',message:'Failed to send verification email',data:{error:emailError instanceof Error ? emailError.message : String(emailError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw emailError
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/resend-verification/route.ts:token-generation-failed',message:'Failed to generate verification tokens',data:{hasCode:!!codeResult.code,hasToken:!!linkResult.token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error('Failed to generate verification tokens')
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { code: 'resend_failed', message: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}

