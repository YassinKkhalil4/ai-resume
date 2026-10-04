import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeRedis } from './helpers/fake-redis'

const resume = (name: string) => ({ summary: name, skills: [], experience: [], education: [], certifications: [] }) as any
const tailored = (name: string) => ({ summary: name, skills_section: [], experience: [] }) as any
const stats = {} as any

beforeEach(async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(createFakeRedis())
})

test('session version differs when content differs and is stable when equal', async () => {
  const { computeSessionVersion } = await import('../lib/sessions')
  const a = computeSessionVersion(resume('a'), tailored('a'))
  const b = computeSessionVersion(resume('b'), tailored('b'))
  assert.notEqual(a, b)
  assert.equal(a, computeSessionVersion(resume('a'), tailored('a')))
  assert.match(a, /^[0-9a-f]{16}$/)
})

test('createSession stores a content-derived version and updateSession changes it', async () => {
  const { createSession, updateSession } = await import('../lib/sessions')
  const s = await createSession(resume('a'), tailored('a'), 'jd', stats, 'raw', 'user-1')
  const updated = await updateSession(s.id, { tailored: tailored('changed') })
  assert.notEqual(updated!.version, s.version)
})

test('getOwnedSession returns the session only for its owner', async () => {
  const { createSession, getOwnedSession } = await import('../lib/sessions')
  const s = await createSession(resume('a'), tailored('a'), 'jd', stats, 'raw', 'user-1')
  assert.equal((await getOwnedSession(s.id, 'user-1'))?.id, s.id)
  assert.equal(await getOwnedSession(s.id, 'user-2'), null)
  assert.equal(await getOwnedSession('missing', 'user-1'), null)
})

test('getOwnedSession refuses legacy sessions that have no owner', async () => {
  const { getOwnedSession } = await import('../lib/sessions')
  const { getRedisClient } = await import('../lib/redis')
  await getRedisClient()!.setex('session:legacy', 60, JSON.stringify({ id: 'legacy', version: 'x', createdAt: Date.now() }))
  assert.equal(await getOwnedSession('legacy', 'user-1'), null)
})
