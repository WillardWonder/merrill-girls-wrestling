import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is not set.");

const credentials = JSON.parse(readFileSync(keyPath, "utf8"));
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(credentials),
  });

const db = getFirestore(app);
const ref = db.doc("teams/merrill-girls-wrestling/curriculum/week-06-self-talk");
const snap = await ref.get();

if (!snap.exists) {
  throw new Error("week-06-self-talk curriculum document was not found.");
}

function rewrite(value: unknown): unknown {
  if (typeof value === "string") {
    const replacements: Array<[string, string]> = [
      ["Instead of 'do not mess up,' use 'good stance'", "Good stance"],
      ["Instead of 'I cannot,' use 'one job'", "One job"],
      ["Instead of replaying the score, use 'next exchange'", "Next exchange"],
    ];

    let next = value;
    for (const [oldText, newText] of replacements) {
      next = next.replaceAll(oldText, newText);
    }
    return next;
  }

  if (Array.isArray(value)) return value.map(rewrite);

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewrite(child);
    }
    return out;
  }

  return value;
}

const before = snap.data()!;
const after = rewrite(before) as Record<string, unknown>;

if (JSON.stringify(before) !== JSON.stringify(after)) {
  await ref.set(after, { merge: true });
  console.log("Updated live Firestore self-talk examples.");
} else {
  console.log("Live Firestore self-talk examples were already clean.");
}
