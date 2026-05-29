import { NextRequest, NextResponse, after } from 'next/server'
import { extractTextFromFile, heuristicParseResume, validateResumeUpload } from '../../../lib/parsers'
import { getTailoredResume, normalizeExperienceForTailor, createFallbackResponse } from '../../../lib/ai-response-parser'
import { createSession, getSession, RedisUnavailableError } from '../../../lib/sessions'
import { atsCheck, compareKeywordStats } from '../../../lib/ats'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { startTrace, logRequestTelemetry, logError } from '../../../lib/telemetry'
import { createUserFriendlyError } from '../../../lib/ai-error-handler'
import { validateParsingResult, shouldShowExperienceBanner } from '../../../lib/parsing-validation'
import { Tone, ResumeJSON } from '../../../lib/types'
import { honestyScan } from '../../../lib/honesty'
import { extractJDFromUrl, validateUrl, inferIndustry } from '../../../lib/jd'
import { enforceUrlFetchRateLimit } from '../../../lib/guards'
import { requireEmailVerification } from '../../../lib/guards'
import { commitCreditReservation, CreditReservation, NoCreditsError, releaseCreditReservation, reserveCredit } from '../../../lib/billing/deduct-credit'
import { createHash } from 'crypto'
import { db, tailoringRuns } from '../../../lib/db'
import { trackEvent, getContext } from '../../../lib/analytics/tracker'
import { v4 as uuid } from 'uuid'
import { createTailorRun, logEvent, completeRun, failRun } from '../../../lib/trace/tracer'
import { RESUME_PARSE, JD_ANALYSIS, HONESTY_CHECK, PRESENTATION_GUARD } from '../../../lib/trace/stages'
import { checkPresentationQuality } from '../../../lib/presentation-guard'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  console.log('Rolefit API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  let session_id: string | undefined
  let resume_file: File | null = null
  let jd_text_raw: string = ''
  let tone: Tone = 'professional'
  let tailorRunId: string | null = null
  let creditReservation: CreditReservation | null = null

  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    const cfg = await getConfig()
    if (cfg.pauseTailor) {
      return NextResponse.json({ code: 'tailor_paused', message: 'Tailoring functionality is temporarily disabled' }, { status: 503 })
    }
    console.log('Guard check passed')

    // Authenticate user and check email verification
    const verificationCheck = await requireEmailVerification(req)
    if (!verificationCheck.ok) {
      return verificationCheck.res
    }
    const user = verificationCheck.user

    // Check credits
    try {
      // User is already authenticated and verified, continue
    } catch (error) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'Authentication required. Please sign in to tailor your resume.' },
        { status: 401 }
      )
    }

    const trace = startTrace({ route: 'tailor' })
    console.log('Trace started')

    // Create tailor run for tracing
    tailorRunId = await createTailorRun({
      userId: user.id,
      sessionId: session_id,
      featureFlags: {},
    })

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json({ code: 'invalid_content_type', message: 'Request must be multipart/form-data' }, { status: 415 })
    }

    const form = await req.formData()
    session_id = form.get('session_id')?.toString()
    const mode = form.get('mode')?.toString()
    const jd_url = form.get('jd_url')?.toString()
    resume_file = form.get('resume_file') as unknown as File | null
    jd_text_raw = form.get('jd_text')?.toString() || ''
    tone = (form.get('tone')?.toString() as Tone) || 'professional'
    const strictHonestyModeRaw = form.get('strict_honesty_mode')?.toString()
    const strictHonestyMode = strictHonestyModeRaw === 'false' || strictHonestyModeRaw === '0' ? false : true

    if (mode === 'fetchOnly') {
      if (!jd_url) {
        return NextResponse.json({ code: 'missing_jd_url', message: 'Job description URL is required' }, { status: 400 })
      }

      // Apply rate limiting for URL fetching
      const rateLimitCheck = await enforceUrlFetchRateLimit(req)
      if (!rateLimitCheck.ok) {
        return rateLimitCheck.res
      }

      try {
        console.log('Fetch-only mode: fetching JD from URL', { jd_url })

        // Validate URL security
        try {
          validateUrl(jd_url)
        } catch (validationError) {
          return NextResponse.json({
            code: 'invalid_url',
            message: validationError instanceof Error ? validationError.message : 'Invalid or unsafe URL'
          }, { status: 400 })
        }

        // Extract job description with new enhanced extraction
        const extractionResult = await extractJDFromUrl(jd_url)

        if (!extractionResult.text || extractionResult.text.trim().length < 50) {
          return NextResponse.json({
            code: 'empty_jd_text',
            message: 'Could not extract meaningful content from the provided URL. The page may not contain a job description.'
          }, { status: 422 })
        }

        // Return enhanced response with validation info
        return NextResponse.json({
          success: true,
          mode: 'fetchOnly',
          jd_text: extractionResult.text,
          truncated: extractionResult.truncated,
          originalLength: extractionResult.originalLength,
          validation: {
            valid: extractionResult.validation.valid,
            score: extractionResult.validation.score,
            issues: extractionResult.validation.issues
          }
        })
      } catch (fetchError) {
        console.error('Failed to fetch JD text:', fetchError)

        // Provide better error messages based on error type
        let errorCode = 'jd_fetch_failed'
        let statusCode = 500
        let errorMessage = 'Failed to fetch job description'

        if (fetchError instanceof Error) {
          errorMessage = fetchError.message

          if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            errorCode = 'timeout'
            statusCode = 408
          } else if (errorMessage.includes('HTTP 4')) {
            errorCode = 'http_error'
            statusCode = 422
          } else if (errorMessage.includes('security') || errorMessage.includes('Invalid URL')) {
            errorCode = 'invalid_url'
            statusCode = 400
          } else if (errorMessage.includes('Could not find')) {
            errorCode = 'no_content'
            statusCode = 422
          }
        }

        return NextResponse.json({
          code: errorCode,
          message: errorMessage
        }, { status: statusCode })
      }
    }

    console.log('Processing request:', {
      hasResumeFile: !!resume_file,
      sessionId: session_id,
      jdTextLength: jd_text_raw.length,
      tone,
    })

    if (!jd_text_raw) return NextResponse.json({ code: 'missing_jd', message: 'Missing jd_text' }, { status: 400 })

    let original: ResumeJSON
    let resumeText: string
    let ext: string | undefined

    // Session-based flow: resume already confirmed via Confirm Experience; no file needed
    if (session_id && !resume_file) {
      const existingSession = await getSession(session_id)
      if (!existingSession?.original) {
        return NextResponse.json(
          { code: 'missing_resume', message: 'Upload a resume or provide experience first.' },
          { status: 400 }
        )
      }
      original = existingSession.original
      resumeText = existingSession.originalRawText ?? ''
      ext = undefined
    } else {
      if (!resume_file) {
        return NextResponse.json({ code: 'missing_resume', message: 'Missing resume input' }, { status: 400 })
      }
      const fileValidation = validateResumeUpload(resume_file)
      if (fileValidation.ok === false) {
        return NextResponse.json(
          { code: fileValidation.code, message: fileValidation.message },
          { status: fileValidation.status }
        )
      }
      const parsed = await extractTextFromFile(resume_file)

      // Check for scanned PDF error
      if (parsed.error === 'scanned_pdf') {
        return NextResponse.json({
          code: 'scanned_pdf',
          message: parsed.message || 'Your PDF appears to be scanned. Please upload DOCX or a text-based PDF (File → Save as PDF).'
        }, { status: 400 })
      }

      resumeText = parsed.text
      ext = parsed.ext

      console.log('Parsing resume...')
      original = heuristicParseResume(resumeText)
      console.log('Resume parsed successfully:', {
        hasSummary: !!original.summary,
        skillsCount: original.skills?.length || 0,
        experienceCount: original.experience?.length || 0,
        educationCount: original.education?.length || 0,
        certificationsCount: original.certifications?.length || 0
      })
    }

    // Validate parsing results
    const validation = validateParsingResult(original)
    console.log('Parsing validation:', validation)

    // Log resume parsing event (non-blocking - fire and forget)
    logEvent(tailorRunId, RESUME_PARSE, 'parse_complete', {
      file_type: ext || 'unknown',
      extraction_method: 'heuristic',
      char_count: resumeText.length,
      sections_detected: [
        original.summary ? 'summary' : null,
        original.skills?.length ? 'skills' : null,
        original.experience?.length ? 'experience' : null,
        original.education?.length ? 'education' : null,
        original.certifications?.length ? 'certifications' : null,
      ].filter(Boolean) as string[],
      roles_parsed: original.experience?.length || 0,
      bullets_parsed: original.experience?.reduce((sum, role) => sum + (role.bullets?.length || 0), 0) || 0,
      parse_confidence: validation.errors.length === 0 ? 0.95 : validation.warnings.length > 0 ? 0.85 : 0.75,
      warnings: [...validation.errors, ...validation.warnings],
    }).catch(err => console.error('Failed to log resume parse event:', err))

    // Helper: create draft session so user can recover via Confirm Experience flow
    const buildExperienceRecovery422 = async (
      code: string,
      message: string,
      payload: { validation?: any; original_sections_json?: any; suggestions?: string[]; role?: string } = {}
    ) => {
      const baselineATS = atsCheck(original, jd_text_raw)
      const fallback = createFallbackResponse(original, jd_text_raw, baselineATS)
      const ats = compareKeywordStats(baselineATS, atsCheck(fallback as ResumeJSON, jd_text_raw))
      const draftSession = await createSession(original, fallback, jd_text_raw, ats, resumeText)
      return NextResponse.json(
        {
          code,
          message,
          draft_session_id: draftSession.id,
          original_raw_text: resumeText,
          original_sections_json: original,
          ...payload,
        },
        { status: 422 }
      )
    }

    // Check if we should block due to completely missing experience (AI hallucination prevention)
    if (shouldShowExperienceBanner(validation)) {
      return buildExperienceRecovery422('missing_experience', 'No work experience detected in your resume', {
        validation,
        suggestions: [
          'Paste your work history manually',
          'Try uploading a different resume format',
          'Check if your resume has experience section headings',
        ],
      })
    }

    // Heuristic-derived experience must not be auto-tailored (AI hallucination prevention)
    if (original.experienceSource === 'heuristic') {
      return buildExperienceRecovery422(
        'heuristic_experience',
        'Experience was detected by pattern matching. Please confirm or add your experience before tailoring.',
        { validation, suggestions: ['Confirm section mapping', 'Paste your work history manually'] }
      )
    }

    // Normalize experience (dedupe by company+role); roles without bullets are simply dropped
    const { normalizedExperience, rolesWithNoBullets } = normalizeExperienceForTailor(original)
    const resumeForTailor = { ...original, experience: normalizedExperience }

    // Log JD analysis event
    const industry = inferIndustry(jd_text_raw)
    const industryConfidence: Record<string, number> = {}
    if (industry.key !== 'general') {
      // Calculate confidence based on keyword matches
      const matchCount = industry.jdKeywords.length
      const totalKeywords = industry.canonicalKeywords.length
      industryConfidence[industry.label] = totalKeywords > 0 ? matchCount / totalKeywords : 0
    }

    // Extract role title (simple heuristic - first line or common patterns)
    const roleTitleMatch = jd_text_raw.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Intern|Analyst|Associate|Manager|Director|Engineer|Developer|Designer|Consultant))/)
    const roleTitleDetected = roleTitleMatch ? roleTitleMatch[1] : undefined

    // Extract signals (key phrases)
    const signals: string[] = []
    const lowerJd = jd_text_raw.toLowerCase()
    if (lowerJd.includes('private equity')) signals.push('private equity')
    if (lowerJd.includes('investment')) signals.push('investment')
    if (lowerJd.includes('saas')) signals.push('saas')
    if (lowerJd.includes('capital')) signals.push('capital')
    if (lowerJd.includes('due diligence')) signals.push('due diligence')

    // Log JD analysis event (non-blocking - fire and forget)
    logEvent(tailorRunId, JD_ANALYSIS, 'analysis_complete', {
      jd_length: jd_text_raw.length,
      role_title_detected: roleTitleDetected,
      industry_primary: industry.key !== 'general' ? industry.label : undefined,
      industry_secondary: undefined, // Could be enhanced to detect secondary industry
      industry_confidence: industryConfidence,
      signals,
    }).catch(err => console.error('Failed to log JD analysis event:', err))

    const resumeHash = createHash('sha256').update(resumeText).digest('hex')
    const tailorStartTime = Date.now()
    try {
      creditReservation = await reserveCredit(user.id, resumeHash)
      console.log('Credit reserved successfully for user:', user.id)
    } catch (error) {
      if (error instanceof NoCreditsError) {
        return NextResponse.json(
          {
            code: 'no_credits',
            message: 'You have no credits remaining. Please purchase credits to continue.',
            creditsRemaining: user.creditsRemaining,
          },
          { status: 402 } // Payment Required
        )
      }
      throw error
    }

    console.log('Tailoring resume...')
    console.log('About to call getTailoredResume...')
    const deadline = Date.now() + 25000

    // Optionally use queue if available, otherwise use direct call
    const { addAIJob, isQueueAvailable, waitForJob } = await import('../../../lib/ai-queue')
    let tailored: any
    let tokens: number
    let ats: any

    if (isQueueAvailable() && process.env.USE_AI_QUEUE !== 'false') {
      // Use queue system
      const jobResult = await addAIJob({
        type: 'tailor',
        original: resumeForTailor,
        jdText: jd_text_raw,
        tone,
        options: { deadline, runId: tailorRunId, strictHonestyMode },
      })

      if (jobResult) {
        // Wait for job completion (with timeout)
        const result = await waitForJob(jobResult.jobId, 30000)
        if (result) {
          tailored = result.tailored
          tokens = result.tokens
          ats = result.ats
        } else {
          throw new Error('Job timed out or failed')
        }
      } else {
        // Queue not available, fall back to direct call
        const result = await getTailoredResume(resumeForTailor, jd_text_raw, tone, { deadline, runId: tailorRunId, strictHonestyMode })
        tailored = result.tailored
        tokens = result.tokens
        ats = result.ats
      }
    } else {
      // Direct call (queue not available or disabled)
      const result = await getTailoredResume(resumeForTailor, jd_text_raw, tone, { deadline, runId: tailorRunId, strictHonestyMode })
      tailored = result.tailored
      tokens = result.tokens
      ats = result.ats
    }

    console.log('getTailoredResume completed successfully')
    console.log('Resume tailored successfully:', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      atsOriginal: ats.original.coverage,
      atsTailored: ats.tailored.coverage
    })

    console.log('Creating session...')
    const session = await createSession(original, tailored, jd_text_raw, ats, resumeText)
    console.log('Session created:', session.id)

    await commitCreditReservation(creditReservation!, tokens)
    creditReservation = null

    // Calculate metrics needed for response
    const timeToComplete = Math.floor((Date.now() - tailorStartTime) / 1000)
    const keywordsAdded = Math.max(0, (ats.tailored.matched?.length || 0) - (ats.original.matched?.length || 0))
    const industryLabel = ats.tailored.industry?.label || null

    // Run honesty scan and presentation check in parallel (both needed for response)
    const [honestyResult, presentationResult] = await Promise.all([
      Promise.resolve(honestyScan(original.experience || [], tailored.experience || [])),
      Promise.resolve(checkPresentationQuality(tailored as any, ats.tailored.allKeywords || []))
    ])

    // Get updated credit balance (needed for response)
    const { getUserCredits } = await import('../../../lib/auth/utils')
    const updatedCredits = await getUserCredits(user.id)

    // Prepare response data
    const responseData = {
      session_id: session.id,
      version: session.version,
      original_sections_json: original,
      original_raw_text: resumeText,
      preview_sections_json: tailored,
      keyword_stats: ats,
      tokens_used: tokens,
      message: 'Resume tailored successfully',
      credits_remaining: updatedCredits,
      credit_used: true,
      validation,
      honesty_scan: {
        flags: honestyResult.flags,
        results: honestyResult.results,
        flagged_count: honestyResult.flags.length,
        has_concerns: honestyResult.flags.length > 0
      },
      parsing_details: {
        original_sections_found: {
          summary: !!original.summary,
          skills: (original.skills?.length || 0) > 0,
          experience: (original.experience?.length || 0) > 0,
          education: (original.education?.length || 0) > 0,
          certifications: (original.certifications?.length || 0) > 0
        },
        tailored_sections_generated: {
          summary: !!tailored.summary,
          skills: (tailored.skills_section?.length || 0) > 0,
          experience: (tailored.experience?.length || 0) > 0
        }
      }
    }

    // Schedule all non-critical side-effects to run AFTER the response is sent.
    // next/server `after()` integrates with the Vercel/Node.js lifecycle so the
    // lambda is kept alive until these complete — unlike a bare Promise.all.
    const context = getContext(req)
    after(async () => {
      try {
        await Promise.all([
          // Telemetry
          Promise.resolve(logRequestTelemetry({
            req_id: trace.id,
            route: 'tailor',
            timing: Date.now() - (trace as any).startTime,
            final_status: 'success',
            additional_metrics: {
              resume_length: resumeText.length,
              jd_length: jd_text_raw.length,
              tone,
              tokens_used: tokens,
              ats_original_coverage: ats.original.coverage,
              ats_tailored_coverage: ats.tailored.coverage,
              ats_coverage_gain: ats.deltas.coverage,
              original_experience_count: original.experience?.length || 0,
              tailored_experience_count: tailored.experience?.length || 0,
              validation_errors: validation.errors.length,
              validation_warnings: validation.warnings.length,
            },
          })),
          // Honesty check trace event
          logEvent(tailorRunId, HONESTY_CHECK, 'scan_complete', {
            threshold: 0.20,
            flagged_bullets: honestyResult.flags.map(flag => ({
              role: flag.role,
              bullet: flag.bullet,
              score: flag.score,
              reason: flag.reason || 'Similarity below threshold',
            })),
            safe_expansions_used: [],
            blocked_claims: honestyResult.flags.map(flag => flag.bullet),
          }),
          // Presentation guard trace event
          logEvent(tailorRunId, PRESENTATION_GUARD, 'quality_check', {
            naked_keywords_detected: presentationResult.naked_keywords_detected,
            violations: presentationResult.violations.map(v => v.type),
            keywords: presentationResult.keywords,
            auto_fix_applied: presentationResult.auto_fix_applied,
          }),
          // DB: write tailoring_runs row
          db.insert(tailoringRuns).values({
            id: uuid(),
            userId: user.id,
            sessionId: session.id,
            originalAtsScore: ats.original.coverage.toString(),
            tailoredAtsScore: ats.tailored.coverage.toString(),
            atsDelta: ats.deltas.coverage.toString(),
            mustCoverageBefore: (ats.original.mustCoverage || 0).toString(),
            mustCoverageAfter: (ats.tailored.mustCoverage || 0).toString(),
            niceCoverageBefore: ((ats.original.matched?.length || 0) / (ats.original.allKeywords?.length || 1)).toString(),
            niceCoverageAfter: ((ats.tailored.matched?.length || 0) / (ats.tailored.allKeywords?.length || 1)).toString(),
            keywordsAdded,
            honestyFlags: honestyResult.flags.length,
            polishApplied: false,
            timeToComplete,
            tokensUsed: tokens,
            industry: industryLabel,
          }),
          // Analytics: ATS score event
          trackEvent('ats_score_calculated', {
            originalScore: ats.original.coverage,
            tailoredScore: ats.tailored.coverage,
            delta: ats.deltas.coverage,
            mustCoverageDelta: (ats.tailored.mustCoverage || 0) - (ats.original.mustCoverage || 0),
            keywordsAdded,
            honestyFlags: honestyResult.flags.length,
            timeToComplete,
            industry: industryLabel,
          }, context, user.id),
          // Analytics: credit deducted event
          trackEvent('credit_deducted', { creditsRemaining: updatedCredits }, context, user.id),
          // Complete the tailor run trace
          completeRun(tailorRunId, {
            status: 'success',
            modelUsed: 'gpt-4o-mini',
            tokensIn: 0,
            tokensOut: tokens,
            latencyMs: timeToComplete * 1000,
            creditsUsed: 1,
            finalAtsBefore: Math.round(ats.original.coverage * 100),
            finalAtsAfter: Math.round(ats.tailored.coverage * 100),
          }),
          // End request trace
          Promise.resolve(trace.end(true, { session_id: session.id, tokens, ats_original: ats.original.coverage, ats_tailored: ats.tailored.coverage })),
        ])
      } catch (bgError) {
        console.error('[tailor] Background operations failed:', bgError)
      }
    })

    return NextResponse.json(responseData)

  } catch (error) {
    await releaseCreditReservation(creditReservation).catch((releaseError) => {
      console.error('Failed to release reserved credit:', releaseError)
    })

    console.error('Rolefit API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Surface Redis / session storage outages as 503 immediately
    if (error instanceof RedisUnavailableError) {
      return error.statusResponse
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const isTimeoutError = /time budget|timeout/i.test(errorMessage)

    // Mark run as failed
    await failRun(tailorRunId, RESUME_PARSE, error as Error)

    // Create detailed error information
    const errorDetails = {
      route: 'tailor',
      session_id: session_id || 'unknown',
      hasResumeFile: !!resume_file,
      jdLength: jd_text_raw.length,
      tone: tone || 'unknown',
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    }

    // Log the error with context
    logError(error as Error, errorDetails)

    // Create user-friendly error message
    const userMessage = createUserFriendlyError(error as Error, errorDetails)

    if (isTimeoutError) {
      return NextResponse.json({
        code: 'function_timeout',
        message: 'Tailoring took too long and was cancelled. Please try again with a shorter resume or job description.',
        timestamp: new Date().toISOString(),
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }, { status: 504 })
    }

    // Ensure we always return a proper JSON response
    try {
      return NextResponse.json({
        code: 'server_error',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        timestamp: new Date().toISOString(),
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }, { status: 500 })
    } catch (jsonError) {
      console.error('Failed to create JSON response:', jsonError)
      // Fallback to JSON response even if JSON creation fails
      return NextResponse.json({
        code: 'server_error',
        message: 'An unexpected error occurred'
      }, { status: 500 })
    }
  }
}
