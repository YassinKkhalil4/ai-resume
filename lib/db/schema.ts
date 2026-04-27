import { pgTable, uuid, text, integer, decimal, timestamp, boolean, jsonb, date, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  stripeCustomerId: text('stripe_customer_id'),
  billingProvider: text('billing_provider'),
  providerCustomerId: text('provider_customer_id'),
  creditsRemaining: integer('credits_remaining').notNull().default(0),
  isAdmin: boolean('is_admin').notNull().default(false),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripePaymentId: text('stripe_payment_id').unique(),
  paymentProvider: text('payment_provider').notNull().default('stripe'),
  providerOrderId: text('provider_order_id'),
  providerCustomerId: text('provider_customer_id'),
  providerVariantId: text('provider_variant_id'),
  providerEventKey: text('provider_event_key'),
  creditsAdded: integer('credits_added').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  providerOrderIdx: uniqueIndex('credit_transactions_provider_order_idx').on(table.paymentProvider, table.providerOrderId),
}))

export const creditLots = pgTable('credit_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: text('source').notNull(), // 'checkout' | 'subscription' | 'admin' | 'backfill'
  stripePaymentId: text('stripe_payment_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  paymentProvider: text('payment_provider'),
  providerOrderId: text('provider_order_id'),
  providerCustomerId: text('provider_customer_id'),
  providerVariantId: text('provider_variant_id'),
  providerEventKey: text('provider_event_key'),
  creditsTotal: integer('credits_total').notNull(),
  creditsRemaining: integer('credits_remaining').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('credit_lots_user_id_idx').on(table.userId),
  expiresAtIdx: index('credit_lots_expires_at_idx').on(table.expiresAt),
}))

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id'),
  resumeHash: text('resume_hash'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  tokensUsed: integer('tokens_used'),
})

export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull().default('stripe'),
  eventId: text('event_id'),
  providerEventKey: text('provider_event_key'),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  manualReviewReason: text('manual_review_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  providerEventIdx: uniqueIndex('webhook_logs_provider_event_idx').on(table.provider, table.providerEventKey),
}))

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: text('event_name').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId: text('session_id').notNull(),
  properties: jsonb('properties'),
  context: jsonb('context'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => ({
  eventNameIdx: index('analytics_events_event_name_idx').on(table.eventName),
  userIdIdx: index('analytics_events_user_id_idx').on(table.userId),
  timestampIdx: index('analytics_events_timestamp_idx').on(table.timestamp),
  sessionIdIdx: index('analytics_events_session_id_idx').on(table.sessionId),
}))

export const analyticsSessions = pgTable('analytics_sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  deviceType: text('device_type'),
  country: text('country'),
  referralSource: text('referral_source'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  pageViews: integer('page_views').notNull().default(0),
})

export const tailoringRuns = pgTable('tailoring_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  originalAtsScore: decimal('original_ats_score', { precision: 5, scale: 4 }),
  tailoredAtsScore: decimal('tailored_ats_score', { precision: 5, scale: 4 }),
  atsDelta: decimal('ats_delta', { precision: 5, scale: 4 }),
  mustCoverageBefore: decimal('must_coverage_before', { precision: 5, scale: 4 }),
  mustCoverageAfter: decimal('must_coverage_after', { precision: 5, scale: 4 }),
  niceCoverageBefore: decimal('nice_coverage_before', { precision: 5, scale: 4 }),
  niceCoverageAfter: decimal('nice_coverage_after', { precision: 5, scale: 4 }),
  keywordsAdded: integer('keywords_added').default(0),
  honestyFlags: integer('honesty_flags').default(0),
  polishApplied: boolean('polish_applied').default(false),
  timeToComplete: integer('time_to_complete'),
  tokensUsed: integer('tokens_used'),
  industry: text('industry'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const analyticsDailyRollups = pgTable('analytics_daily_rollups', {
  date: date('date').primaryKey(),
  dau: integer('dau').notNull().default(0),
  wau: integer('wau').notNull().default(0),
  mau: integer('mau').notNull().default(0),
  totalTailoringRuns: integer('total_tailoring_runs').notNull().default(0),
  avgAtsImprovement: decimal('avg_ats_improvement', { precision: 5, scale: 4 }),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 4 }),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  newUsers: integer('new_users').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
})

export const universityMetrics = pgTable('university_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  universityDomain: text('university_domain').notNull().unique(),
  universityName: text('university_name'),
  userCount: integer('user_count').notNull().default(0),
  totalRuns: integer('total_runs').notNull().default(0),
  creditsConsumed: integer('credits_consumed').notNull().default(0),
  conversionToPaid: decimal('conversion_to_paid', { precision: 5, scale: 4 }),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
})

export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('contact_messages_email_idx').on(table.email),
  statusIdx: index('contact_messages_status_idx').on(table.status),
  createdAtIdx: index('contact_messages_created_at_idx').on(table.createdAt),
}))

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  code: text('code'),
  type: text('type').notNull(), // 'code' | 'link'
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index('email_verification_tokens_token_idx').on(table.token),
  userIdIdx: index('email_verification_tokens_user_id_idx').on(table.userId),
  codeIdx: index('email_verification_tokens_code_idx').on(table.code),
}))

export const tailorRuns = pgTable('tailor_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  status: text('status').$type<'success' | 'failed' | 'partial'>().default('success'),
  modelUsed: text('model_used'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  latencyMs: integer('latency_ms'),
  creditsUsed: integer('credits_used'),
  featureFlags: jsonb('feature_flags'),
  finalAtsBefore: integer('final_ats_before'),
  finalAtsAfter: integer('final_ats_after'),
}, (table) => ({
  userIdIdx: index('tailor_runs_user_id_idx').on(table.userId),
  sessionIdIdx: index('tailor_runs_session_id_idx').on(table.sessionId),
  statusIdx: index('tailor_runs_status_idx').on(table.status),
  createdAtIdx: index('tailor_runs_created_at_idx').on(table.createdAt),
}))

export const tailorRunEvents = pgTable('tailor_run_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => tailorRuns.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  stage: text('stage').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
}, (table) => ({
  runIdIdx: index('tailor_run_events_run_id_idx').on(table.runId),
  timestampIdx: index('tailor_run_events_timestamp_idx').on(table.timestamp),
  stageIdx: index('tailor_run_events_stage_idx').on(table.stage),
  runIdTimestampIdx: index('tailor_run_events_run_id_timestamp_idx').on(table.runId, table.timestamp),
}))

export const tailorDebugSnapshots = pgTable('tailor_debug_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => tailorRuns.id, { onDelete: 'cascade' }),
  snapshotType: text('snapshot_type').notNull(),
  content: text('content').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  runIdIdx: index('tailor_debug_snapshots_run_id_idx').on(table.runId),
  expiresAtIdx: index('tailor_debug_snapshots_expires_at_idx').on(table.expiresAt),
}))

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  creditTransactions: many(creditTransactions),
  creditLots: many(creditLots),
  usageLogs: many(usageLogs),
  analyticsEvents: many(analyticsEvents),
  tailoringRuns: many(tailoringRuns),
  tailorRuns: many(tailorRuns),
  contactMessages: many(contactMessages),
}))

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
}))

export const creditLotsRelations = relations(creditLots, ({ one }) => ({
  user: one(users, {
    fields: [creditLots.userId],
    references: [users.id],
  }),
}))

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
}))

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
}))

export const tailoringRunsRelations = relations(tailoringRuns, ({ one }) => ({
  user: one(users, {
    fields: [tailoringRuns.userId],
    references: [users.id],
  }),
}))

export const tailorRunsRelations = relations(tailorRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [tailorRuns.userId],
    references: [users.id],
  }),
  events: many(tailorRunEvents),
  snapshots: many(tailorDebugSnapshots),
}))

export const tailorRunEventsRelations = relations(tailorRunEvents, ({ one }) => ({
  run: one(tailorRuns, {
    fields: [tailorRunEvents.runId],
    references: [tailorRuns.id],
  }),
}))

export const tailorDebugSnapshotsRelations = relations(tailorDebugSnapshots, ({ one }) => ({
  run: one(tailorRuns, {
    fields: [tailorDebugSnapshots.runId],
    references: [tailorRuns.id],
  }),
}))

export const contactMessagesRelations = relations(contactMessages, ({ one }) => ({
  user: one(users, {
    fields: [contactMessages.userId],
    references: [users.id],
  }),
}))

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type CreditTransaction = typeof creditTransactions.$inferSelect
export type NewCreditTransaction = typeof creditTransactions.$inferInsert
export type UsageLog = typeof usageLogs.$inferSelect
export type NewUsageLog = typeof usageLogs.$inferInsert
export type WebhookLog = typeof webhookLogs.$inferSelect
export type NewWebhookLog = typeof webhookLogs.$inferInsert
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
export type AnalyticsSession = typeof analyticsSessions.$inferSelect
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert
export type TailoringRun = typeof tailoringRuns.$inferSelect
export type NewTailoringRun = typeof tailoringRuns.$inferInsert
export type AnalyticsDailyRollup = typeof analyticsDailyRollups.$inferSelect
export type NewAnalyticsDailyRollup = typeof analyticsDailyRollups.$inferInsert
export type UniversityMetric = typeof universityMetrics.$inferSelect
export type NewUniversityMetric = typeof universityMetrics.$inferInsert
export type ContactMessage = typeof contactMessages.$inferSelect
export type NewContactMessage = typeof contactMessages.$inferInsert
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert
export type TailorRun = typeof tailorRuns.$inferSelect
export type NewTailorRun = typeof tailorRuns.$inferInsert
export type TailorRunEvent = typeof tailorRunEvents.$inferSelect
export type NewTailorRunEvent = typeof tailorRunEvents.$inferInsert
export type TailorDebugSnapshot = typeof tailorDebugSnapshots.$inferSelect
export type NewTailorDebugSnapshot = typeof tailorDebugSnapshots.$inferInsert
