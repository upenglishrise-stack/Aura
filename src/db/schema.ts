import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (primary user profiles synchronized with Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  username: text('username'),
  photo: text('photo'),
  photos: text('photos'),
  bio: text('bio'),
  age: integer('age'),
  gender: text('gender'),
  interests: text('interests'), // Stored as a comma-separated string
  role: text('role').default('user'), // 'user', 'creator'
  isSubscribed: boolean('is_subscribed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User interactions / swipes tracking
export const swipes = pgTable('swipes', {
  id: serial('id').primaryKey(),
  senderUid: text('sender_uid').notNull(),
  receiverUid: text('receiver_uid').notNull(),
  action: text('action').notNull(), // 'like', 'pass', 'super'
  createdAt: timestamp('created_at').defaultNow(),
});

// Direct Messages
export const dbMessages = pgTable('db_messages', {
  id: serial('id').primaryKey(),
  senderUid: text('sender_uid').notNull(),
  receiverUid: text('receiver_uid').notNull(),
  text: text('text'),
  image: text('image'),
  timeString: text('time_string'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User data tracking for telemetry and behavior analysis
export const userTracking = pgTable('user_tracking', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid'), // Optional, can track guest/anonymous actions too
  eventType: text('event_type').notNull(), // 'page_view', 'action_click', 'auth_event', etc.
  screenName: text('screen_name'), // e.g. 'discover', 'stories', 'chat'
  details: text('details'), // JSON string with key metrics or metadata
  timestamp: timestamp('timestamp').defaultNow(),
});

// Define Relationships
export const usersRelations = relations(users, ({ many }) => ({
  swipesSent: many(swipes, { relationName: 'senderSwipes' }),
  messagesSent: many(dbMessages, { relationName: 'senderMessages' }),
  messagesReceived: many(dbMessages, { relationName: 'receiverMessages' }),
}));
