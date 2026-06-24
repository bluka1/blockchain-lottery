require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { admin, db } = require("./src/config/firebase");

const app = express();

app.use(cors());
app.use(express.json());

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

app.get("/api/lotteries/stats/number-frequency", async (req, res) => {
  try {
    const MIN_NUMBER = 1;
    const MAX_NUMBER = 50;

    const snapshot = await db.collection("lotteries").get();

    const counts = new Map();
    for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
      counts.set(n, 0);
    }

    let totalDraws = 0;
    snapshot.docs.forEach((doc) => {
      const combo = doc.data().winningCombo;
      if (!Array.isArray(combo) || combo.length === 0) {
        return;
      }
      totalDraws += 1;
      combo.forEach((value) => {
        const number = Number(value);
        if (counts.has(number)) {
          counts.set(number, counts.get(number) + 1);
        }
      });
    });

    const items = Array.from(counts.entries()).map(([number, count]) => ({
      number,
      count,
    }));

    return res.json({ ok: true, totalDraws, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Failed to compute number frequency" });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});