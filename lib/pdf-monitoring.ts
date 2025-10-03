import { logError, logPDFGeneration } from './telemetry'

export interface PDFFailureAlert {
  timestamp: string
  sessionId: string
  method: string
  error: string
  htmlLength: number
  retryCount: number
  fallbackUsed: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface PDFMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  averageResponseTime: number
  methodBreakdown: Record<string, { count: number; successRate: number }>
  qualityBreakdown: Record<string, number>
  errorBreakdown: Record<string, number>
}

class PDFMonitoringService {
  private failureThresholds = {
    low: 5,      // 5 failures in 5 minutes
    medium: 10,  // 10 failures in 5 minutes  
    high: 20,    // 20 failures in 5 minutes
    critical: 50 // 50 failures in 5 minutes
  }

  private alertCooldowns = new Map<string, number>()
  private metrics: PDFMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    successRate: 0,
    averageResponseTime: 0,
    methodBreakdown: {},
    qualityBreakdown: {},
    errorBreakdown: {}
  }

  async trackPDFRequest(method: string, success: boolean, responseTime: number, error?: string, quality?: string) {
    this.metrics.totalRequests++
    
    if (success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    // Update success rate
    this.metrics.successRate = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / this.metrics.totalRequests

    // Update method breakdown
    if (!this.metrics.methodBreakdown[method]) {
      this.metrics.methodBreakdown[method] = { count: 0, successRate: 0 }
    }
    this.metrics.methodBreakdown[method].count++
    this.metrics.methodBreakdown[method].successRate = 
      (this.metrics.methodBreakdown[method].count * this.metrics.methodBreakdown[method].successRate + (success ? 1 : 0)) / 
      this.metrics.methodBreakdown[method].count

    // Update quality breakdown
    if (quality) {
      this.metrics.qualityBreakdown[quality] = (this.metrics.qualityBreakdown[quality] || 0) + 1
    }

    // Update error breakdown
    if (error) {
      this.metrics.errorBreakdown[error] = (this.metrics.errorBreakdown[error] || 0) + 1
    }

    // Check for alert conditions
    if (!success) {
      await this.checkAlertConditions(method, error || 'Unknown error')
    }
  }

  private async checkAlertConditions(method: string, error: string) {
    const now = Date.now()
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    
    // Count recent failures
    const recentFailures = this.metrics.failedRequests // Simplified for demo
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    
    if (recentFailures >= this.failureThresholds.critical) {
      severity = 'critical'
    } else if (recentFailures >= this.failureThresholds.high) {
      severity = 'high'
    } else if (recentFailures >= this.failureThresholds.medium) {
      severity = 'medium'
    }

    // Check cooldown to avoid spam
    const alertKey = `${method}-${severity}`
    const lastAlert = this.alertCooldowns.get(alertKey) || 0
    const cooldownPeriod = severity === 'critical' ? 60000 : 300000 // 1 min for critical, 5 min for others
    
    if (now - lastAlert < cooldownPeriod) {
      return // Still in cooldown
    }

    // Send alert
    await this.sendAlert({
      timestamp: new Date().toISOString(),
      sessionId: 'system',
      method,
      error,
      htmlLength: 0,
      retryCount: 0,
      fallbackUsed: false,
      severity
    })

    this.alertCooldowns.set(alertKey, now)
  }

  private async sendAlert(alert: PDFFailureAlert) {
    console.error(`🚨 PDF ALERT [${alert.severity.toUpperCase()}]:`, {
      method: alert.method,
      error: alert.error,
      severity: alert.severity,
      timestamp: alert.timestamp
    })

    // Log to telemetry
    logError(new Error(`PDF Alert: ${alert.error}`), {
      alert,
      severity: alert.severity,
      method: alert.method
    })

    // Send to external monitoring service if configured
    if (process.env.MONITORING_WEBHOOK_URL) {
      try {
        await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 PDF Generation Alert [${alert.severity.toUpperCase()}]`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 
                     alert.severity === 'high' ? 'warning' : 'good',
              fields: [
                { title: 'Method', value: alert.method, short: true },
                { title: 'Error', value: alert.error, short: false },
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Time', value: alert.timestamp, short: true }
              ]
            }]
          })
        })
      } catch (error) {
        console.error('Failed to send monitoring webhook:', error)
      }
    }

    // Send email alert for critical issues
    if (alert.severity === 'critical' && process.env.ALERT_EMAIL) {
      await this.sendEmailAlert(alert)
    }
  }

  private async sendEmailAlert(alert: PDFFailureAlert) {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    console.error(`📧 CRITICAL PDF FAILURE - Email alert would be sent to ${process.env.ALERT_EMAIL}`)
  }

  getMetrics(): PDFMetrics {
    return { ...this.metrics }
  }

  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      methodBreakdown: {},
      qualityBreakdown: {},
      errorBreakdown: {}
    }
  }

  // Health check endpoint data
  getHealthStatus() {
    const successRate = this.metrics.successRate
    const avgResponseTime = this.metrics.averageResponseTime

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let issues: string[] = []

    if (successRate < 80) {
      status = 'unhealthy'
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`)
    } else if (successRate < 95) {
      status = 'degraded'
      issues.push(`Degraded success rate: ${successRate.toFixed(1)}%`)
    }

    if (avgResponseTime > 10000) {
      status = status === 'healthy' ? 'degraded' : status
      issues.push(`Slow response time: ${avgResponseTime.toFixed(0)}ms`)
    }

    return {
      status,
      issues,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    }
  }
}

// Singleton instance
export const pdfMonitoring = new PDFMonitoringService()

// Enhanced logging functions
export async function trackPDFSuccess(method: string, responseTime: number, quality: string) {
  await pdfMonitoring.trackPDFRequest(method, true, responseTime, undefined, quality)
  logPDFGeneration(1, true, undefined, method, 0)
}

export async function trackPDFFailure(method: string, error: string, responseTime: number = 0) {
  await pdfMonitoring.trackPDFRequest(method, false, responseTime, error)
  logPDFGeneration(1, false, error, method, 0)
}

// Health check endpoint
export async function getPDFHealthStatus() {
  return pdfMonitoring.getHealthStatus()
}

// Metrics endpoint
export function getPDFMetrics() {
  return pdfMonitoring.getMetrics()
}
