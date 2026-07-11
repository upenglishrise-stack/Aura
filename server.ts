import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { db } from "./src/db/index.ts";
import { users, swipes, dbMessages, userTracking } from "./src/db/schema.ts";
import { eq, and, or, desc, like, ilike } from "drizzle-orm";
import { requireAuth, optionalAuth, AuthRequest } from "./src/middleware/auth.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Routes

  // 1. Get or Create User Profile
  app.get("/api/users/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid));
      
      if (userList.length === 0) {
        // Return 404 to indicate client should onboard
        return res.status(404).json({ message: "Profile not found. Onboarding required." });
      }
      
      res.json(userList[0]);
    } catch (error: any) {
      console.error("Failed to fetch user profile from Postgres:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.post("/api/users/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { email, name, username, photo, photos, bio, age, gender, interests, role, isSubscribed } = req.body;

      const result = await db.insert(users)
        .values({
          uid,
          email: email || req.user.email || "",
          name: name || null,
          username: username || null,
          photo: photo || null,
          photos: photos ? (typeof photos === 'string' ? photos : JSON.stringify(photos)) : null,
          bio: bio || null,
          age: typeof age === 'number' ? age : null,
          gender: gender || null,
          interests: interests || null,
          role: role || 'user',
          isSubscribed: !!isSubscribed,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: email || req.user.email || "",
            name: name || null,
            username: username || null,
            photo: photo || null,
            photos: photos ? (typeof photos === 'string' ? photos : JSON.stringify(photos)) : null,
            bio: bio || null,
            age: typeof age === 'number' ? age : null,
            gender: gender || null,
            interests: interests || null,
            role: role || 'user',
            isSubscribed: !!isSubscribed,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Log tracking event
      await db.insert(userTracking).values({
        userUid: uid,
        eventType: "profile_update",
        screenName: "edit_profile",
        details: JSON.stringify({ name, role, isSubscribed }),
      });

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to save profile in Postgres:", error);
      res.status(500).json({ error: "Failed to save user profile" });
    }
  });

  // 1c. Get all registered user profiles
  app.get("/api/users/all", optionalAuth, async (req: AuthRequest, res) => {
    try {
      let excludedUids: string[] = [];
      if (req.user && req.user.uid) {
        const activeBlocked = await db.select().from(swipes).where(
          and(
            eq(swipes.senderUid, req.user.uid),
            or(eq(swipes.action, 'block'), eq(swipes.action, 'report'))
          )
        );
        excludedUids = activeBlocked.map(b => b.receiverUid);
      }

      const allUsers = await db.select().from(users).limit(100);
      const filteredUsers = allUsers.filter(u => !excludedUids.includes(u.uid));
      res.json(filteredUsers);
    } catch (error: any) {
      console.error("Failed to fetch all users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // 1b. Search User Profiles in PostgreSQL
  app.get("/api/users/search", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.trim() === "") {
        return res.json([]);
      }

      const uid = req.user.uid;
      const activeBlocked = await db.select().from(swipes).where(
        and(
          eq(swipes.senderUid, uid),
          or(eq(swipes.action, 'block'), eq(swipes.action, 'report'))
        )
      );
      const excludedUids = activeBlocked.map(b => b.receiverUid);

      const searchPattern = `%${q.trim()}%`;
      const matchedUsers = await db
        .select()
        .from(users)
        .where(
          or(
            ilike(users.username, searchPattern),
            ilike(users.name, searchPattern),
            ilike(users.email, searchPattern)
          )
        )
        .limit(30);

      const filteredUsers = matchedUsers.filter(u => !excludedUids.includes(u.uid));
      res.json(filteredUsers);
    } catch (error: any) {
      console.error("Failed to search users in Postgres:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // 2. Track Event
  app.post("/api/tracking/event", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { eventType, screenName, details } = req.body;
      const userUid = req.user ? req.user.uid : "guest";

      await db.insert(userTracking).values({
        userUid,
        eventType,
        screenName: screenName || null,
        details: details ? JSON.stringify(details) : null,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Tracking event write failed:", error);
      res.status(500).json({ error: "Failed to log tracking event" });
    }
  });

  // 3. Get Tracking History for User Data Dashboard
  app.get("/api/tracking/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const trackingLogs = await db
        .select()
        .from(userTracking)
        .where(eq(userTracking.userUid, uid))
        .orderBy(desc(userTracking.timestamp));

      res.json(trackingLogs);
    } catch (error: any) {
      console.error("Failed to fetch tracking history:", error);
      res.status(500).json({ error: "Failed to fetch tracking data" });
    }
  });

  // 4. Get and Send Messages
  app.get("/api/messages", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { partnerUid } = req.query;

      if (!partnerUid || typeof partnerUid !== "string") {
        return res.status(400).json({ error: "partnerUid query parameter required" });
      }

      const allMessages = await db
        .select()
        .from(dbMessages)
        .where(
          or(
            and(eq(dbMessages.senderUid, uid), eq(dbMessages.receiverUid, partnerUid)),
            and(eq(dbMessages.senderUid, partnerUid), eq(dbMessages.receiverUid, uid))
          )
        )
        .orderBy(dbMessages.createdAt);

      res.json(allMessages);
    } catch (error: any) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { receiverUid, text, image, timeString } = req.body;

      if (!receiverUid) {
        return res.status(400).json({ error: "receiverUid is required" });
      }

      const result = await db.insert(dbMessages)
        .values({
          senderUid: uid,
          receiverUid,
          text: text || null,
          image: image || null,
          timeString: timeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
        .returning();

      // Log tracking event
      await db.insert(userTracking).values({
        userUid: uid,
        eventType: "send_message",
        screenName: "chat",
        details: JSON.stringify({ recipient: receiverUid, textLength: text ? text.length : 0 }),
      });

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  // 5. Swipe Actions and Matches
  app.post("/api/swipes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { receiverUid, action } = req.body; // 'like', 'pass', 'super'

      if (!receiverUid || !action) {
        return res.status(400).json({ error: "receiverUid and action are required" });
      }

      const result = await db.insert(swipes)
        .values({
          senderUid: uid,
          receiverUid,
          action,
        })
        .returning();

      // Log tracking event
      await db.insert(userTracking).values({
        userUid: uid,
        eventType: `swipe_${action}`,
        screenName: "discover",
        details: JSON.stringify({ swipedUser: receiverUid }),
      });

      // Check for Mutual Match: Has receiverUid also swiped 'like' or 'super' on uid?
      const reciprocalSwipes = await db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.senderUid, receiverUid),
            eq(swipes.receiverUid, uid),
            or(eq(swipes.action, "like"), eq(swipes.action, "super"))
          )
        );

      const isMatch = reciprocalSwipes.length > 0 && (action === "like" || action === "super");

      if (isMatch) {
        // Track match event
        await db.insert(userTracking).values({
          userUid: uid,
          eventType: "mutual_match",
          screenName: "discover",
          details: JSON.stringify({ matchedWith: receiverUid }),
        });
      }

      res.json({ swipe: result[0], isMatch });
    } catch (error: any) {
      console.error("Failed to record swipe:", error);
      res.status(500).json({ error: "Failed to record swipe" });
    }
  });

  // 5a. Block User Profile (Persist block in PostgreSQL swipes table with action 'block')
  app.post("/api/blocks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { receiverUid } = req.body;

      if (!receiverUid) {
        return res.status(400).json({ error: "receiverUid is required" });
      }

      const result = await db.insert(swipes)
        .values({
          senderUid: uid,
          receiverUid,
          action: "block",
        })
        .returning();

      // Log tracking event
      await db.insert(userTracking).values({
        userUid: uid,
        eventType: "user_blocked",
        screenName: "profile_detail",
        details: JSON.stringify({ blockedUid: receiverUid }),
      });

      res.json({ success: true, block: result[0] });
    } catch (error: any) {
      console.error("Failed to record block in Postgres:", error);
      res.status(500).json({ error: "Failed to block user" });
    }
  });

  // 5b. Report User Profile (Persist report in PostgreSQL swipes table with action 'report')
  app.post("/api/reports", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;
      const { receiverUid, reason } = req.body;

      if (!receiverUid) {
        return res.status(400).json({ error: "receiverUid is required" });
      }

      const result = await db.insert(swipes)
        .values({
          senderUid: uid,
          receiverUid,
          action: "report",
        })
        .returning();

      // Log tracking event
      await db.insert(userTracking).values({
        userUid: uid,
        eventType: "user_reported",
        screenName: "profile_detail",
        details: JSON.stringify({ reportedUid: receiverUid, reason: reason || "inappropriate content" }),
      });

      res.json({ success: true, report: result[0] });
    } catch (error: any) {
      console.error("Failed to record report in Postgres:", error);
      res.status(500).json({ error: "Failed to report user" });
    }
  });

  // Get mutual follower/matched list
  app.get("/api/swipes/mutual", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user.uid;

      // Users you swiped 'like' or 'super'
      const likesSent = await db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.senderUid, uid),
            or(eq(swipes.action, "like"), eq(swipes.action, "super"))
          )
        );

      const likedUserIds = likesSent.map((s) => s.receiverUid);

      if (likedUserIds.length === 0) {
        return res.json([]);
      }

      // Users who liked you back
      const reciprocalLikes = await db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.receiverUid, uid),
            or(eq(swipes.action, "like"), eq(swipes.action, "super"))
          )
        );

      const reciprocalUserIds = new Set(reciprocalLikes.map((s) => s.senderUid));
      const mutualIds = likedUserIds.filter((id) => reciprocalUserIds.has(id));

      res.json(mutualIds);
    } catch (error: any) {
      console.error("Failed to fetch mutual matches:", error);
      res.status(500).json({ error: "Failed to fetch mutual matches" });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
