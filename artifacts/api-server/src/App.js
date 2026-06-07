import express from "express";
import cors from "cors";
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    res.status(201).json({ uid: user.uid, email: user.email });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken();
    res.json({ uid: user.uid, email: user.email, token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post("/api/auth/logout", async (_req, res) => {
  try {
    await signOut(auth);
    res.json({ message: "Signed out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Firestore CRUD Routes ────────────────────────────────────────────────────

// Create a document in a collection
app.post("/api/data/:collection", async (req, res) => {
  try {
    const col = collection(db, req.params.collection);
    const docRef = await addDoc(col, {
      ...req.body,
      createdAt: serverTimestamp(),
    });
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents in a collection
app.get("/api/data/:collection", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, req.params.collection));
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single document
app.get("/api/data/:collection/:id", async (req, res) => {
  try {
    const docRef = doc(db, req.params.collection, req.params.id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json({ id: snapshot.id, ...snapshot.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a document
app.patch("/api/data/:collection/:id", async (req, res) => {
  try {
    const docRef = doc(db, req.params.collection, req.params.id);
    await updateDoc(docRef, { ...req.body, updatedAt: serverTimestamp() });
    res.json({ message: "Document updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a document
app.delete("/api/data/:collection/:id", async (req, res) => {
  try {
    const docRef = doc(db, req.params.collection, req.params.id);
    await deleteDoc(docRef);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
