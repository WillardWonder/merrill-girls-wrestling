import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TEAM_ID = "merrill-girls-wrestling";
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!keyPath) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is not set.");

const credentials = JSON.parse(readFileSync(keyPath, "utf8"));
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(credentials),
  });

const db = getFirestore(app);

const replacements: Array<[RegExp, string]> = [
  [/You do not need to manufacture a task today\.?/gi, "Recharge for what's next. Recovery builds readiness."],
  [/No practice is open\.?/gi, "Recovery day."],
  [/No practice today\.?/gi, "Recovery day."],
  [/This is not therapy\.?/gi, "Use this to reset your focus."],
  [/This isn(?:'|’)t therapy\.?/gi, "Use this to reset your focus."],
  [/Not therapy\.?/gi, "Use this to reset your focus."],

  [/The Five Cs help you notice your current state\. They are not a grade and they do not define you\. The useful question is what changed and what helped\./gi,
    "The Five Cs help you notice where you are right now. Use them to spot what is working and choose one thing to support today."],
  [/Notice, do not judge/gi, "Notice what changed"],
  [/You do not have to eliminate every unhelpful thought\. You need language that directs attention toward a useful response\./gi,
    "Choose words that direct your attention toward a useful response."],
  [/Keep working after failure, breakdown, or slow progress\./gi,
    "Keep working through tough moments and slow progress."],

  [/Don(?:'|’)t rush\.?/gi, "Settle. Stance. First job."],
  [/Don(?:'|’)t panic\.?/gi, "Easy breath. Find your stance."],
  [/Don(?:'|’)t dwell on it\.?/gi, "Next exchange."],
  [/Stay positive!?/gi, "One adjustment. Next exchange."],
  [/Believe in yourself\.?/gi, "Trust the work you've done."],
  [/You got this!?/gi, "Trust your work."],

  [/Select a controllable performance objective\.?/gi, "What's your 1% today?"],
  [/Identify an effective response following adversity\.?/gi, "If something goes wrong, what's your next job?"],
  [/Redirect attentional focus toward task-relevant stimuli\.?/gi, "Bring your attention back to the next job."],
  [/Choose an instructional self-talk intervention\.?/gi, "What do you need to tell yourself?"],
  [/Identify evidence supporting self-efficacy\.?/gi, "What happened today that proves you're getting better?"],
  [/Record evidence supporting confidence\.?/gi, "What happened today that proves you're getting better?"],
  [/Develop an if-then coping strategy\.?/gi, "If this happens, what will you do?"],
];

function rewrite(value: unknown): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const [pattern, replacement] of replacements) {
      next = next.replace(pattern, replacement);
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

const collections = [
  "curriculum",
  "exampleBuckets",
  "teamChallenges",
  "techniqueTerms",
];

let updated = 0;

for (const name of collections) {
  const snapshot = await db.collection(`teams/${TEAM_ID}/${name}`).get();

  for (const doc of snapshot.docs) {
    // Rejected Merrill terminology must not remain in production.
    if (name === "techniqueTerms") {
      const data = doc.data();
      const values = [
        doc.id,
        data.id,
        data.slug,
        data.key,
        data.term,
        data.name,
        data.label,
      ]
        .filter((x) => typeof x === "string")
        .map((x) => String(x).toLowerCase().replaceAll("_", "-").trim());

      if (values.some((x) => x === "run-pipe" || x === "run pipe")) {
        await doc.ref.delete();
        console.log(`deleted rejected term: ${doc.ref.path}`);
        updated += 1;
        continue;
      }
    }

    const before = doc.data();
    const after = rewrite(before) as Record<string, unknown>;

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await doc.ref.set(after, { merge: true });
      console.log(`updated Firestore: ${doc.ref.path}`);
      updated += 1;
    }
  }
}

console.log(`Firestore documents changed: ${updated}`);
