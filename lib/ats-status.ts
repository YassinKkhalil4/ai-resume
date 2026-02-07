/**
 * ATS Status System
 * Provides status labels and explanations based on coverage percentage
 */

export type ATSStatus = 'Not Passing' | 'Borderline' | 'Pass' | 'Strong Pass'

export interface ATSStatusInfo {
  status: ATSStatus
  coverage: number
  explanation: string
  statusColor: string
  statusBgColor: string
}

/**
 * Determine ATS status based on coverage percentage
 */
export function getATSStatus(coverage: number): ATSStatus {
  if (coverage >= 85) return 'Strong Pass'
  if (coverage >= 75) return 'Pass'
  if (coverage >= 65) return 'Borderline'
  return 'Not Passing'
}

/**
 * Get status color classes
 */
export function getStatusColors(status: ATSStatus): { text: string; bg: string; border: string } {
  switch (status) {
    case 'Strong Pass':
      return {
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-200 dark:border-emerald-800'
      }
    case 'Pass':
      return {
        text: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800'
      }
    case 'Borderline':
      return {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800'
      }
    case 'Not Passing':
      return {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        border: 'border-rose-200 dark:border-rose-800'
      }
  }
}

/**
 * Get explanation text based on status and coverage
 * This explains why optimization stopped where it did
 */
export function getATSExplanation(status: ATSStatus, coverage: number): string {
  switch (status) {
    case 'Strong Pass':
      return 'Your resume comfortably passes automated screening systems. Further keyword optimization would reduce readability and may harm recruiter trust, so optimization was intentionally stopped here.'
    
    case 'Pass':
      return 'Your resume meets automated screening requirements. Additional optimization focused on clarity and accuracy rather than increasing keyword density.'
    
    case 'Borderline':
      return 'Your resume may pass some automated systems but could be filtered out by others. Improvements were limited by the experience currently represented in your resume.'
    
    case 'Not Passing':
      return 'Your resume is missing key requirements from the job description. This tool does not add experience you don\'t have, so further improvement may require adding real projects, coursework, or experience.'
    
    default:
      return ''
  }
}

/**
 * Get tooltip text for "Why not optimize further?" info icon
 */
export function getATSTooltipText(): string {
  return 'Why not optimize further? Once a resume clearly passes automated screening, additional keyword optimization often makes it less readable and more suspicious to recruiters.'
}

/**
 * Get complete ATS status information
 */
export function getATSStatusInfo(coverage: number): ATSStatusInfo {
  const status = getATSStatus(coverage)
  const colors = getStatusColors(status)
  
  return {
    status,
    coverage,
    explanation: getATSExplanation(status, coverage),
    statusColor: colors.text,
    statusBgColor: colors.bg
  }
}

