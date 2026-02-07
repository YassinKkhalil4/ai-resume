import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { validateInviteCode } from '../../../../lib/auth/invite-codes'
import { detectUniversity } from '../../../../lib/analytics/university-detector'
import { trackEvent, getContext } from '../../../../lib/analytics/tracker'
import { generateVerificationToken } from '../../../../lib/auth/verification'
import { sendVerificationResend } from '../../../../lib/email/resend'

export async function POST(req: NextRequest) {
  // #region agent log
  const logEntry = {location:'app/api/auth/signup/route.ts:POST:entry',message:'Signup request started',data:{hasBody:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
  fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry)}).catch(()=>{});
  // #endregion
  try {
    const body = await req.json()
    const { email, password, inviteCode } = body

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-parse',message:'Body parsed',data:{hasEmail:!!email,hasPassword:!!password,hasInviteCode:!!inviteCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!email || !password) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate invite code if provided
    const inviteValidation = validateInviteCode(inviteCode)
    if (!inviteValidation.valid) {
      return NextResponse.json(
        { code: 'invalid_invite', message: inviteValidation.message },
        { status: 400 }
      )
    }

    // Check if user already exists
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:before-check-existing',message:'About to check for existing user',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    let existingUser
    try {
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-check-existing',message:'Existing user check completed',data:{found:!!existingUser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } catch (dbError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:db-check-error',message:'Database check failed',data:{error:dbError instanceof Error ? dbError.message : String(dbError),stack:dbError instanceof Error ? dbError.stack : undefined,errorName:dbError instanceof Error ? dbError.constructor.name : typeof dbError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Database query failed - this is a critical error, return error response
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      console.error('Database query failed during signup:', dbError)
      return NextResponse.json(
        { 
          code: 'database_error', 
          message: 'Database connection error. Please ensure the database is set up and migrations have been run. Run: npm run db:push' 
        },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { code: 'user_exists', message: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with 1 free credit (email not verified yet)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:before-insert',message:'About to insert user',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        creditsRemaining: 1, // Free credit on signup
        emailVerified: true, // Temporarily auto-verify until Resend is set up
      })
      .returning()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-insert',message:'User created',data:{userId:newUser.id,email:newUser.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Track university domain detection if applicable
    const university = detectUniversity(email)
    if (university) {
      const context = getContext(req)
      await trackEvent('university_domain_detected', {
        domain: university.domain,
        universityName: university.name,
      }, context, newUser.id)
    }

    // Track invite code usage if provided
    if (inviteCode) {
      const context = getContext(req)
      await trackEvent('invite_code_used', {
        inviteCode,
      }, context, newUser.id)
    }

    // Generate verification tokens (both code and link)
    // Wrap in try-catch to ensure signup succeeds even if verification fails
    let emailSent = false
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:before-verification',message:'About to generate verification tokens',data:{userId:newUser.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
    try {
      const codeResult = await generateVerificationToken(newUser.id, 'code')
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-code-token',message:'Code token generated',data:{hasCode:!!codeResult.code},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        try {
      const linkResult = await generateVerificationToken(newUser.id, 'link')
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-link-token',message:'Link token generated',data:{hasToken:!!linkResult.token},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
      
      // Send verification email with both options
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:before-send-email',message:'About to send verification email',data:{email:newUser.email,hasResendKey:!!process.env.RESEND_API_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          try {
      await sendVerificationResend(
        newUser.email,
        codeResult.code || '',
        linkResult.token
      )
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:after-send-email',message:'Verification email sent successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            emailSent = true
    } catch (emailError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:email-send-error',message:'Email sending failed',data:{error:emailError instanceof Error ? emailError.message : String(emailError),stack:emailError instanceof Error ? emailError.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
      console.error('Failed to send verification email:', emailError)
            emailSent = false
            // Don't fail signup if email fails
          }
        } catch (linkError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:link-token-error',message:'Link token generation failed',data:{error:linkError instanceof Error ? linkError.message : String(linkError),stack:linkError instanceof Error ? linkError.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          console.error('Failed to generate link token:', linkError)
          // Continue without link token
        }
      } catch (codeError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:code-token-error',message:'Code token generation failed',data:{error:codeError instanceof Error ? codeError.message : String(codeError),stack:codeError instanceof Error ? codeError.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error('Failed to generate code token:', codeError)
        // Continue without verification tokens - user can request resend later
      }
    } catch (verificationError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:verification-error',message:'Verification setup failed',data:{error:verificationError instanceof Error ? verificationError.message : String(verificationError),stack:verificationError instanceof Error ? verificationError.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('Failed to set up email verification:', verificationError)
      // Don't fail signup if verification setup fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        creditsRemaining: newUser.creditsRemaining,
        emailVerified: newUser.emailVerified,
      },
      message: emailSent 
        ? 'Account created successfully. Please check your email to verify your account.'
        : 'Account created successfully. However, we were unable to send the verification email. Please use the "Resend verification email" button in the verification modal.',
      emailSent,
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/signup/route.ts:POST:catch',message:'Signup error caught',data:{error:error instanceof Error ? error.message : String(error),stack:error instanceof Error ? error.stack : undefined,errorName:error instanceof Error ? error.constructor.name : typeof error,isDrizzleError:error instanceof Error && error.message.includes('Failed query'),hasDatabaseUrl:!!process.env.DATABASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Signup error:', error)
    
    // Provide more helpful error message for database issues
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Failed query') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
      return NextResponse.json(
        { 
          code: 'database_error', 
          message: 'Database connection error. Please ensure the database is set up and migrations have been run. Run: npm run db:push' 
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { code: 'signup_failed', message: 'Failed to create account' },
      { status: 500 }
    )
  }
}

