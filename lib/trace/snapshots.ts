import { db, tailorDebugSnapshots, NewTailorDebugSnapshot } from '../db'
import { eq, lt } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

export type SnapshotType = 'resume_original' | 'resume_tailored' | 'jd_raw'

const SNAPSHOT_TTL_MINUTES = 60

/**
 * Saves a debug snapshot with 60-minute TTL
 * Non-blocking - failures are logged but don't throw
 */
export async function saveSnapshot(
  runId: string | null,
  type: SnapshotType,
  content: string
): Promise<void> {
  if (!runId) {
    return // Silently skip if no run ID
  }

  try {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + SNAPSHOT_TTL_MINUTES)

    const snapshot: NewTailorDebugSnapshot = {
      id: uuid(),
      runId,
      snapshotType: type,
      content,
      expiresAt,
    }

    await db.insert(tailorDebugSnapshots).values(snapshot)
  } catch (error) {
    console.error(`Failed to save snapshot (type: ${type}):`, error)
    // Don't throw - snapshot failures should never break the pipeline
  }
}

/**
 * Retrieves all snapshots for a run
 */
export async function getSnapshots(runId: string): Promise<Array<{
  id: string
  snapshotType: SnapshotType
  content: string
  createdAt: Date
}>> {
  try {
    const snapshots = await db
      .select({
        id: tailorDebugSnapshots.id,
        snapshotType: tailorDebugSnapshots.snapshotType,
        content: tailorDebugSnapshots.content,
        createdAt: tailorDebugSnapshots.createdAt,
      })
      .from(tailorDebugSnapshots)
      .where(eq(tailorDebugSnapshots.runId, runId))

    return snapshots.map(s => ({
      id: s.id,
      snapshotType: s.snapshotType as SnapshotType,
      content: s.content,
      createdAt: s.createdAt,
    }))
  } catch (error) {
    console.error('Failed to get snapshots:', error)
    return []
  }
}

/**
 * Cleans up expired snapshots
 * Should be called periodically (e.g., via cron job or scheduled task)
 */
export async function cleanupExpiredSnapshots(): Promise<number> {
  try {
    const now = new Date()
    // First, count how many will be deleted
    const toDelete = await db
      .select()
      .from(tailorDebugSnapshots)
      .where(lt(tailorDebugSnapshots.expiresAt, now))
    const count = toDelete.length
    
    // Then delete them
    await db
      .delete(tailorDebugSnapshots)
      .where(lt(tailorDebugSnapshots.expiresAt, now))

    return count
  } catch (error) {
    console.error('Failed to cleanup expired snapshots:', error)
    return 0
  }
}

