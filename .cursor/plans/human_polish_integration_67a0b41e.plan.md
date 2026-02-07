---
name: Human Polish Integration
overview: Integrate the human polish and credibility prompt into the resume tailoring system to improve natural readability and professional presentation while maintaining ATS performance and honesty constraints.
todos:
  - id: update_system_prompt
    content: Enhance SYSTEM_PROMPT in lib/prompts.ts with human polish role definition, keyword naturalization rules, and credibility guidelines
    status: completed
  - id: enhance_user_prompt
    content: Add natural keyword integration examples and anti-keyword-stuffing instructions to makeUserPrompt()
    status: completed
  - id: verify_compatibility
    content: Verify that naturalized phrasing works with existing honesty checks and ATS matching logic
    status: completed
  - id: test_ats_coverage
    content: Test that keywords embedded in natural phrases are still detected by ATS matching
    status: completed
  - id: test_honesty_checks
    content: Verify that natural phrasing maintains sufficient token overlap to pass honesty threshold
    status: completed
---

# Human Polish & Credibility Integration Plan

## Overview

Enhance the resume tailoring system to produce more natural, human-readable resumes that don't appear AI-generated, while preserving ATS keyword coverage and honesty constraints.

## Changes Required

### 1. Update System Prompt (`lib/prompts.ts`)

- **File**: `lib/prompts.ts`
- **Action**: Enhance `SYSTEM_PROMPT` to include the human polish guidelines
- **Key additions**:
  - Professional resume editor role definition
  - Keyword naturalization rules (convert isolated keywords to natural phrasing)
  - Human-first formatting guidelines
  - Credibility over aggression principles
  - Finance/Consulting/Tech sensitivity rules
  - Quality check criteria

**Structure**:

```typescript
export const SYSTEM_PROMPT = `You are a professional resume editor and former recruiter...
[Existing integrity constraints]
[New human polish rules]
[Quality check requirements]`
```

### 2. Enhance User Prompt (`lib/prompts.ts`)

- **File**: `lib/prompts.ts`  
- **Function**: `makeUserPrompt()`
- **Action**: Add explicit instructions for natural keyword integration
- **Key additions**:
  - Emphasize embedding keywords in natural context
  - Add examples of good vs bad keyword usage
  - Include instructions to avoid keyword-stuffing patterns
  - Maintain existing ATS optimization directives

### 3. Update Tone Integration

- **File**: `lib/prompts.ts`
- **Action**: Ensure tone options work harmoniously with polish rules
- **Note**: Existing tones (`professional`, `concise`, `impact-heavy`) should all benefit from polish improvements

### 4. Verify Honesty Check Compatibility

- **File**: `lib/honesty.ts`
- **Action**: Verify that naturalized phrasing doesn't trigger false positives
- **Note**: The honesty threshold (0.20) should still work correctly with more natural phrasing

### 5. Test ATS Keyword Preservation

- **Files**: `lib/ats.ts`, `lib/ai-response-parser.ts`
- **Action**: Ensure naturalized keywords are still detected by ATS matching
- **Verification**: Test that keywords embedded in natural phrases are still matched

## Implementation Details

### System Prompt Structure

The enhanced system prompt will:

1. **Maintain existing integrity constraints** (no fabrication, no new metrics, etc.)
2. **Add human polish role definition** (professional editor/recruiter perspective)
3. **Include keyword naturalization rules**:

   - Convert isolated keywords to natural phrases
   - Example: "saas, api, platform" → "SaaS-based platforms and API-driven systems"

4. **Add credibility guidelines**:

   - Avoid buzzword stacking
   - Prefer measured, precise language
   - Sound like a smart, self-aware candidate

5. **Include quality check criteria**:

   - Would this pass a skeptical recruiter's 10-second scan?
   - Does this sound like a real human?
   - Are ATS keywords present but invisible to humans?

### User Prompt Enhancements

The user prompt will include:

- Explicit examples of natural keyword integration
- Instructions to avoid robotic repetition
- Guidance on professional phrasing patterns
- Emphasis on context-rich keyword placement

### Compatibility Considerations

- **Honesty checks**: Natural phrasing may have slightly different token overlap, but should still pass the 0.20 threshold
- **ATS matching**: Keywords in natural phrases are matched via substring and fuzzy matching, so coverage should be preserved
- **Existing tones**: All three tone options will benefit from polish improvements

## Testing Strategy

1. **ATS Coverage**: Verify that naturalized resumes maintain or improve keyword coverage
2. **Honesty Validation**: Ensure natural phrasing doesn't trigger false flags
3. **Human Readability**: Review sample outputs for natural, professional tone
4. **Keyword Detection**: Confirm embedded keywords are still matched by ATS logic

## Files to Modify

1. `lib/prompts.ts` - System and user prompt updates
2. No other files need changes (honesty checks and ATS matching already support natural phrasing)

## Success Criteria

- Resumes read naturally without appearing AI-generated
- ATS keyword coverage maintained or improved
- Honesty checks continue to work correctly
- Professional credibility enhanced across all tone options