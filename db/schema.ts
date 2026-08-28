import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  subject: text("subject").notNull().default("미지정"),
  grade: text("grade").notNull().default("미지정"),
  template: text("template", { enum: ["LOOP_24", "RACE_24"] }).notNull(),
  skin: text("skin", { enum: ["CAMPUS", "SPACE_LAB", "ECO_EXPEDITION"] }).notNull(),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "PENDING_REVIEW"] }).notNull().default("DRAFT"),
  visibility: text("visibility", { enum: ["PRIVATE", "UNLISTED", "PUBLIC"] }).notNull().default("PRIVATE"),
  questionsCount: integer("questions_count").notNull().default(0),
  cardsCount: integer("cards_count").notNull().default(0),
  sourceVersionId: text("source_version_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_games_owner_updated").on(table.ownerId, table.updatedAt),
  index("idx_games_library").on(table.visibility, table.status, table.updatedAt),
]);

export const gameVersions = sqliteTable("game_versions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  definitionJson: text("definition_json").notNull(),
  immutable: integer("immutable", { mode: "boolean" }).notNull().default(true),
  reviewStatus: text("review_status", { enum: ["PRIVATE", "PENDING_REVIEW", "PUBLIC", "DELISTED", "REJECTED"] }).notNull().default("PRIVATE"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_game_versions_game_number").on(table.gameId, table.versionNumber),
]);

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id),
  hostId: text("host_id").notNull(),
  code: text("code").notNull(),
  status: text("status", { enum: ["LOBBY", "PLAYING", "FINALIZED"] }).notNull().default("LOBBY"),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  uniqueIndex("idx_rooms_code").on(table.code),
  index("idx_rooms_host_created").on(table.hostId, table.createdAt),
]);

export const roomParticipants = sqliteTable("room_participants", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  authUserId: text("auth_user_id").notNull(),
  nickname: text("nickname").notNull(),
  teamNumber: integer("team_number"),
  isTeamLeader: integer("is_team_leader", { mode: "boolean" }).notNull().default(false),
  joinedAt: text("joined_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
}, (table) => [
  uniqueIndex("idx_participants_room_auth").on(table.roomId, table.authUserId),
  index("idx_participants_room").on(table.roomId),
]);
