import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TEAM_ID = "merrill-girls-wrestling";
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is not set.");

const credentials = JSON.parse(readFileSync(keyPath, "utf8"));
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) });
const db = getFirestore(app);

const replacements: Array<[RegExp, string]> = [
  [/Recovery day. Recharge for what's next.\.?/gi, "Recovery day. Recharge for what's next."],
  [/Recovery day.\.?/gi, "Recovery day."],
  [/Recovery day.\.?/gi, "Recovery day."],
  [/Recovery is part of training.\.?/gi, "Recovery is part of training."],
  [/Use this to reset your focus.\.?/gi, "Use this to reset your focus."],
  [/This isn(?:'|’)t therapy\.?/gi, "Use this to reset your focus."],
  [/Use this to reset your focus.\.?/gi, "Use this to reset your focus."],
  [/Don(?:'|’)t rush\.?/gi, "Settle. Stance. First job."],
  [/Don(?:'|’)t panic\.?/gi, "Easy breath. Find your stance."],
  [/Don(?:'|’)t dwell on it\.?/gi, "Next exchange."],
  [/One adjustment. Next exchange.?/gi, "One adjustment. Next exchange."],
  [/Trust the work you've done.\.?/gi, "Trust the work you've done."],
  [/Trust your work.?/gi, "Trust your work."],
  [/Stay with your next job.\.?/gi, "Stay with your next job."],
  [/Keep working the next useful action.\.?/gi, "Keep working the next useful action."],
  [/What's your 1% today?\.?/gi, "What's your 1% today?"],
  [/If something goes wrong, what's your next job?\.?/gi, "If something goes wrong, what's your next job?"],
  [/Bring your attention back to the next job.\.?/gi, "Bring your attention back to the next job."],
  [/What do you need to tell yourself?\.?/gi, "What do you need to tell yourself?"],
  [/What happened today that proves you're getting better?\.?/gi, "What happened today that proves you're getting better?"],
  [/What happened today that proves you're getting better?\.?/gi, "What happened today that proves you're getting better?"],
  [/If this happens, what will you do?\.?/gi, "If this happens, what will you do?"],
  [/\b0 proofs\b/gi, "Nothing saved yet"],
  [/\bNo proofs yet\b/gi, "Your proof starts here"]
];

function rewriteString(value: string) {
  let next = value;
  for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
  return next;
}

function rewrite(value: unknown): unknown {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) out[key] = rewrite(child);
    return out;
  }
  return value;
}

const collections = ["curriculum", "exampleBuckets", "techniqueTerms", "teamChallenges"];
let docsUpdated = 0;
for (const collectionName of collections) {
  const snapshot = await db.collection(`teams/${TEAM_ID}/${collectionName}`).get();
  for (const doc of snapshot.docs) {
    const before = doc.data();
    const after = rewrite(before) as Record<string, unknown>;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await doc.ref.set(after, { merge: true });
      docsUpdated += 1;
      console.log(`updated Firestore: ${doc.ref.path}`);
    }
  }
}
console.log(`Firestore documents updated: ${docsUpdated}`);
