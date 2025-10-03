import { NextRequest, NextResponse } from 'next/server'
import { getPDFHealthStatus, getPDFMetrics } from '../../../../lib/pdf-monitoring'

export async function GET(req: NextRequest) {
  try {
    const healthStatus = await getPDFHealthStatus()
    const metrics = getPDFMetrics()
    
    return NextResponse.json({
      service: 'pdf-generation',
      status: healthStatus.status,
      issues: healthStatus.issues,
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: `${metrics.successRate.toFixed(1)}%`,
        averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
        methodBreakdown: metrics.methodBreakdown,
        qualityBreakdown: metrics.qualityBreakdown,
        errorBreakdown: metrics.errorBreakdown
      },
      timestamp: healthStatus.timestamp,
      uptime: process.uptime()
    })
  } catch (error) {
    return NextResponse.json({
      service: 'pdf-generation',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
