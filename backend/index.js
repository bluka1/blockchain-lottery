const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS env variable");
}

admin.initializeApp({
  credential: admin.credential.cert(
    require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS))
  ),
});

const db = admin.firestore();

// Hello world
app.get("/", (req, res) => {
  res.json({ message: "Hello World API" });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
// Create user
app.post("/api/users", async (req, res) => {
  try {
    const { user_id, picture, name, surname, wallet_address } = req.body;

    if (!user_id || !name || !surname || !wallet_address) {
      return res.status(400).json({
        error: "Missing required fields: user_id, name, surname, wallet_address",
      });
    }

    // users collection, doc id = user_id
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
    return res.status(500).json({ error: "Failed to create user" });
  }
});
// Add lottery record
app.post("/api/lotteries", async (req, res) => {
  try {
    const { date, amount_collected, participants, winners } = req.body;

    if (!date || amount_collected === undefined || !participants || !winners) {
      return res.status(400).json({
        error: "Missing required fields: date, amount_collected, participants, winners",
      });
    }

    if (!Array.isArray(participants) || !Array.isArray(winners)) {
      return res.status(400).json({
        error: "participants and winners must be arrays",
      });
    }

    // lotteries collection (auto ID)
    const docRef = await db.collection("lotteries").add({
      date, // npr "2026-02-08"
      amount_collected, // npr "0.25" ili broj
      participants, // npr ["0xabc...", "0xdef..."]
      winners, // npr ["0xabc..."]
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ ok: true, lottery_id: docRef.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to add lottery record" });
  }
});
