import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { code: 'not_found', message: 'Not found' },
    { status: 404 }
  )
}
