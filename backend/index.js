require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  throw new Error("Missing Firebase environment variables");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Create user
app.post("/api/users", async (req, res) => {
  try {
    const { user_id, picture, name, surname, wallet_address } = req.body;

    if (!user_id || !name || !surname || !wallet_address) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: user_id, name, surname, wallet_address",
      });
    }

    await db.collection("users").doc(user_id).set({
      picture: picture ?? "",
      name,
      surname,
      wallet_address,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ ok: true, user_id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Failed to create user" });
  }
});

// Add lottery record
app.post("/api/lotteries", async (req, res) => {
  try {
    const { date, amount_collected, participants, winners, winningCombo, tx } = req.body;

    if (!date || amount_collected === undefined || !participants || !winners) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: date, amount_collected, participants, winners",
      });
    }

    if (!Array.isArray(participants) || !Array.isArray(winners)) {
      return res.status(400).json({
        ok: false,
        error: "participants and winners must be arrays",
      });
    }

    const docRef = await db.collection("lotteries").add({
      date, // "YYYY-MM-DD"
      amount_collected,
      participants,
      winners,
      winningCombo: Array.isArray(winningCombo) ? winningCombo : undefined,
      tx: typeof tx === "string" ? tx : undefined,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ ok: true, lottery_id: docRef.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Failed to add lottery record" });
  }
});

app.get("/api/lotteries/history", async (req, res) => {
  try {
    const snapshot = await db
      .collection("lotteries")
      .orderBy("date", "desc")
      .limit(50)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        roundId: doc.id,
        date: data.date,
        winningCombo: data.winningCombo ?? [],
        players: Array.isArray(data.participants) ? data.participants.length : 0,
        tx: data.tx ?? "#",
      };
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Failed to fetch history" });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});