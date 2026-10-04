import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeRedis } from './helpers/fake-redis'

const exp = (company: string) => [{ company, role: 'r', dates: 'd', bullets: ['b'] }]
const resume = (company: string) => ({ summary: '', skills: [], experience: exp(company), education: [], certifications: [] }) as any
const tailored = (company: string) => ({ summary: '', skills_section: [], experience: exp(company) }) as any

beforeEach(async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(createFakeRedis())
})

test('direct payloads win and never consult the session or version', async () => {
  const { resolveExperiencePair } = await import('../lib/experience-pair')
  const r = await resolveExperiencePair(
    { session_id: 's', session_version: 'stale', original_payload: { experience: exp('A') }, tailored_payload: { experience: exp('B') } },
    'user-1'
  )
  assert.deepEqual(r, { ok: true, original: exp('A'), tailored: exp('B') })
})

test('falls back to the caller\'s own session', async () => {
  const { createSession } = await import('../lib/sessions')
  const { resolveExperiencePair } = await import('../lib/experience-pair')
  const s = await createSession(resume('A'), tailored('B'), 'jd', {} as any, 'raw', 'user-1')
  const r = await resolveExperiencePair({ session_id: s.id }, 'user-1')
  assert.deepEqual(r, { ok: true, original: exp('A'), tailored: exp('B') })
})

test('does not leak another user\'s session', async () => {
  const { createSession } = await import('../lib/sessions')
  const { resolveExperiencePair } = await import('../lib/experience-pair')
  const s = await createSession(resume('A'), tailored('B'), 'jd', {} as any, 'raw', 'user-1')
  const r = await resolveExperiencePair({ session_id: s.id }, 'user-2')
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, 'missing_data')
})

test('reports a stale session when the fallback version mismatches', async () => {
  const { createSession } = await import('../lib/sessions')
  const { resolveExperiencePair } = await import('../lib/experience-pair')
  const s = await createSession(resume('A'), tailored('B'), 'jd', {} as any, 'raw', 'user-1')
  const r = await resolveExperiencePair({ session_id: s.id, session_version: 'old' }, 'user-1')
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.code, 'stale_session')
    assert.equal(r.status, 409)
  }
})

test('requires a session id', async () => {
  const { resolveExperiencePair } = await import('../lib/experience-pair')
  const r = await resolveExperiencePair({}, 'user-1')
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, 'missing_session_id')
})
