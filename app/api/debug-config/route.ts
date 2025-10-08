import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '../../../lib/config'

export async function GET(req: NextRequest) {
  const cfg = getConfig()
  
  return NextResponse.json({
    invites: cfg.invites,
    hasOpenAIKey: !!cfg.openaiKey,
    pauseTailor: cfg.pauseTailor,
    pauseExport: cfg.pauseExport,
    rate: cfg.rate
  })
}
