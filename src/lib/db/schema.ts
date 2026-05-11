import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

const newId = () => crypto.randomUUID();

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  email: text('email'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  gender: text('gender'),
  duprId: text('dupr_id'),
  selfReportedDupr: real('self_reported_dupr'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
});

export const leagues = sqliteTable(
  'leagues',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    name: text('name').notNull(),
    ownerId: text('owner_id').notNull(),
  },
  (t) => ({
    nameLen: check('leagues_name_len', sql`length(${t.name}) >= 1 and length(${t.name}) <= 255`),
  }),
);

export const leagueMembers = sqliteTable(
  'league_members',
  {
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('player'),
    email: text('email'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.leagueId, t.userId] }),
    roleCheck: check('league_members_role', sql`${t.role} in ('player', 'admin')`),
    userIdx: index('idx_league_members_user_id').on(t.userId),
  }),
);

export const leagueInvites = sqliteTable(
  'league_invites',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    invitedBy: text('invited_by').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    acceptedAt: text('accepted_at'),
  },
  (t) => ({
    statusCheck: check(
      'league_invites_status',
      sql`${t.status} in ('pending', 'accepted', 'revoked')`,
    ),
    emailIdx: index('idx_league_invites_email').on(t.email),
    leagueIdx: index('idx_league_invites_league_id').on(t.leagueId),
  }),
);

export const gameSessions = sqliteTable(
  'game_sessions',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    leagueId: text('league_id').references(() => leagues.id, { onDelete: 'set null' }),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    scheduledFor: text('scheduled_for'),
    location: text('location'),
    playerCount: integer('player_count').notNull(),
  },
  (t) => ({
    playerCountCheck: check(
      'game_sessions_player_count',
      sql`${t.playerCount} in (6, 8, 10, 12)`,
    ),
    leagueScheduledIdx: index('idx_game_sessions_league_scheduled').on(
      t.leagueId,
      t.scheduledFor,
    ),
  }),
);

export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    courtNumber: integer('court_number'),
    scheduledOrder: integer('scheduled_order'),
    status: text('status').notNull().default('scheduled'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => ({
    statusCheck: check(
      'matches_status',
      sql`${t.status} in ('scheduled', 'completed', 'canceled')`,
    ),
    sessionIdx: index('idx_matches_session_id').on(t.sessionId),
  }),
);

export const sessionGuests = sqliteTable(
  'session_guests',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    dupr: real('dupr').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    nameCheck: check(
      'session_guests_display_name',
      sql`length(trim(${t.displayName})) > 0`,
    ),
    duprCheck: check(
      'session_guests_dupr_range',
      sql`${t.dupr} >= 1.0 and ${t.dupr} <= 8.5`,
    ),
    sessionIdx: index('session_guests_session_id_idx').on(t.sessionId),
  }),
);

export const matchPlayers = sqliteTable(
  'match_players',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    guestId: text('guest_id').references(() => sessionGuests.id, { onDelete: 'cascade' }),
    team: integer('team').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    teamCheck: check('match_players_team', sql`${t.team} in (1, 2)`),
    identityCheck: check(
      'match_players_one_identity',
      sql`(${t.userId} is null) <> (${t.guestId} is null)`,
    ),
    userIdx: index('idx_match_players_user_id').on(t.userId),
    matchUserUq: uniqueIndex('match_players_match_user_uq')
      .on(t.matchId, t.userId)
      .where(sql`${t.userId} is not null`),
    matchGuestUq: uniqueIndex('match_players_match_guest_uq')
      .on(t.matchId, t.guestId)
      .where(sql`${t.guestId} is not null`),
  }),
);

export const matchResults = sqliteTable('match_results', {
  matchId: text('match_id')
    .primaryKey()
    .references(() => matches.id, { onDelete: 'cascade' }),
  team1Score: integer('team1_score'),
  team2Score: integer('team2_score'),
  completedAt: text('completed_at'),
});

export const adminEvents = sqliteTable('admin_events', {
  id: text('id').primaryKey().$defaultFn(newId),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  eventType: text('event_type').notNull(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  leagueId: text('league_id').references(() => leagues.id, { onDelete: 'set null' }),
  payload: text('payload'),
});

export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedLeagues: many(leagues),
  memberships: many(leagueMembers),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(leagueMembers),
  invites: many(leagueInvites),
  sessions: many(gameSessions),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  league: one(leagues, {
    fields: [gameSessions.leagueId],
    references: [leagues.id],
  }),
  matches: many(matches),
  guests: many(sessionGuests),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  session: one(gameSessions, {
    fields: [matches.sessionId],
    references: [gameSessions.id],
  }),
  players: many(matchPlayers),
  result: one(matchResults, { fields: [matches.id], references: [matchResults.matchId] }),
}));

export const matchPlayersRelations = relations(matchPlayers, ({ one }) => ({
  match: one(matches, { fields: [matchPlayers.matchId], references: [matches.id] }),
  guest: one(sessionGuests, {
    fields: [matchPlayers.guestId],
    references: [sessionGuests.id],
  }),
}));

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type NewLeagueMember = typeof leagueMembers.$inferInsert;
export type LeagueInvite = typeof leagueInvites.$inferSelect;
export type NewLeagueInvite = typeof leagueInvites.$inferInsert;
export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type SessionGuest = typeof sessionGuests.$inferSelect;
export type NewSessionGuest = typeof sessionGuests.$inferInsert;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type NewMatchPlayer = typeof matchPlayers.$inferInsert;
export type MatchResult = typeof matchResults.$inferSelect;
export type NewMatchResult = typeof matchResults.$inferInsert;
export type AdminEvent = typeof adminEvents.$inferSelect;
export type NewAdminEvent = typeof adminEvents.$inferInsert;
