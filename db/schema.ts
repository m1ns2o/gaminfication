import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const teacherAccounts = sqliteTable("teacher_accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_teacher_accounts_email").on(table.email),
]);

export const teacherSessions = sqliteTable("teacher_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => teacherAccounts.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("idx_teacher_sessions_teacher").on(table.teacherId),
  index("idx_teacher_sessions_expiry").on(table.expiresAt),
]);

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: ["GOOGLE"] }).notNull(),
  providerSubject: text("provider_subject").notNull(),
  teacherId: text("teacher_id").notNull().references(() => teacherAccounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_oauth_accounts_provider_subject").on(table.provider, table.providerSubject),
  index("idx_oauth_accounts_teacher").on(table.teacherId),
]);

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  subject: text("subject").notNull().default("미지정"),
  grade: text("grade").notNull().default("미지정"),
  template: text("template", { enum: ["LOOP_24"] }).notNull(),
  skin: text("skin", { enum: ["CAMPUS", "SPACE_LAB", "ECO_EXPEDITION"] }).notNull(),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "PENDING_REVIEW"] }).notNull().default("DRAFT"),
  visibility: text("visibility", { enum: ["PRIVATE", "UNLISTED", "PUBLIC"] }).notNull().default("PRIVATE"),
  questionsCount: integer("questions_count").notNull().default(0),
  cardsCount: integer("cards_count").notNull().default(0),
  victoryMode: text("victory_mode", { enum: ["AUTO", "SCORE", "ROUNDS", "FINISH"] }).notNull().default("AUTO"),
  targetScore: integer("target_score").notNull().default(100),
  maxRounds: integer("max_rounds").notNull().default(10),
  tileConfigJson: text("tile_config_json").notNull().default("[]"),
  playMode: text("play_mode", { enum: ["INDIVIDUAL", "TEAM"] }).notNull().default("INDIVIDUAL"),
  teamCount: integer("team_count").notNull().default(2),
  sourceVersionId: text("source_version_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_games_owner_updated").on(table.ownerId, table.updatedAt),
  index("idx_games_library").on(table.visibility, table.status, table.updatedAt),
]);

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["MULTIPLE_CHOICE", "SHORT_ANSWER", "OX"] }).notNull(),
  prompt: text("prompt").notNull(),
  optionsJson: text("options_json").notNull().default("[]"),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  points: integer("points").notNull().default(10),
  timeLimitSeconds: integer("time_limit_seconds").notNull().default(30),
  answerMode: text("answer_mode", { enum: ["TURN", "ALL"] }).notNull().default("TURN"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_questions_game_order").on(table.gameId, table.orderIndex),
]);

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  effectType: text("effect_type", { enum: ["MOVE_FORWARD", "MOVE_BACK", "SCORE_BONUS", "EXTRA_TURN", "SKIP_TURN"] }).notNull(),
  effectValue: integer("effect_value").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_cards_game_order").on(table.gameId, table.orderIndex),
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

export const roomResults = sqliteTable("room_results", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull().references(() => roomParticipants.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  score: integer("score").notNull(),
  correctAnswers: integer("correct_answers").notNull().default(0),
  answersCount: integer("answers_count").notNull().default(0),
  rank: integer("rank").notNull(),
  isWinner: integer("is_winner", { mode: "boolean" }).notNull().default(false),
  teamNumber: integer("team_number"),
  teamScore: integer("team_score"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_room_results_participant").on(table.roomId, table.participantId),
  index("idx_room_results_rank").on(table.roomId, table.rank),
]);

export const roomQuestionResponses = sqliteTable("room_question_responses", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  questionSequence: integer("question_sequence").notNull(),
  participantId: text("participant_id").notNull().references(() => roomParticipants.id, { onDelete: "cascade" }),
  questionPrompt: text("question_prompt").notNull(),
  questionType: text("question_type").notNull(),
  answerMode: text("answer_mode").notNull(),
  submittedAnswer: text("submitted_answer").notNull().default(""),
  correctAnswer: text("correct_answer").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  timedOut: integer("timed_out", { mode: "boolean" }).notNull().default(false),
  responseTimeMs: integer("response_time_ms").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_room_responses_attempt_participant").on(table.roomId, table.questionSequence, table.participantId),
  index("idx_room_responses_room_question").on(table.roomId, table.questionId),
  index("idx_room_responses_participant").on(table.roomId, table.participantId),
]);

export const requestRateLimits = sqliteTable("request_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: text("expires_at").notNull(),
});
