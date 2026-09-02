import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "public"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".html"]);

const SKIP = [
  "node_modules",
  "dist",
  ".git",
  "/admin/",
  "/coach/",
  "firebaseGateway",
  "firebaseClient",
  "firestore"
];

const replacements = [
  [/You do not need to manufacture a task today\.?/gi, "Recharge for what's next. Recovery builds readiness."],
  [/No practice is open\.?/gi, "Recovery day."],
  [/No practice today\.?/gi, "Recovery day."],
  [/Nothing you need to check off today\.?/gi, "Recovery is part of training."],

  [/This is not therapy\.?/gi, "Use this to reset your focus."],
  [/This isn(?:'|’)t therapy\.?/gi, "Use this to reset your focus."],
  [/Not therapy\.?/gi, "Use this to reset your focus."],
  [/This is not a mental health tool\.?/gi, "Use this to reset your focus."],
  [/This is not treatment\.?/gi, "Use this to reset your focus."],

  [/Don(?:'|’)t rush\.?/gi, "Settle. Stance. First job."],
  [/Don(?:'|’)t panic\.?/gi, "Easy breath. Find your stance."],
  [/Don(?:'|’)t dwell on it\.?/gi, "Next exchange."],
  [/Don(?:'|’)t mess this up\.?/gi, "Clean setup. Finish."],

  [/Select a controllable performance objective\.?/gi, "What's your 1% today?"],
  [/Identify an effective response following adversity\.?/gi, "If something goes wrong, what's your next job?"],
  [/Redirect attentional focus toward task-relevant stimuli\.?/gi, "Bring your attention back to the next job."],
  [/Choose an instructional self-talk intervention\.?/gi, "What do you need to tell yourself?"],
  [/Identify evidence supporting self-efficacy\.?/gi, "What happened today that proves you're getting better?"],
  [/Record evidence supporting confidence\.?/gi, "What happened today that proves you're getting better?"],
  [/Develop an if-then coping strategy\.?/gi, "If this happens, what will you do?"],

  [/Stay positive!?/gi, "One adjustment. Next exchange."],
  [/Believe in yourself\.?/gi, "Trust the work you've done."],
  [/You got this!?/gi, "Trust your work."],
  [/Be unstoppable\.?/gi, "Stay with your next job."],

  [/\b0 proofs\b/gi, "Nothing saved yet"],
  [/\bNo proofs yet\b/gi, "Your proof starts here"],
];

function skipped(file) {
  const normalized = file.replaceAll("\\", "/");
  return SKIP.some((part) => normalized.includes(part));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (skipped(full)) continue;

    if (entry.isDirectory()) files.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }

  return files;
}

let changed = 0;
let replacementsMade = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    let text = fs.readFileSync(file, "utf8");
    const original = text;

    for (const [pattern, replacement] of replacements) {
      const matches = text.match(pattern);
      if (matches) {
        replacementsMade += matches.length;
        text = text.replace(pattern, replacement);
      }
    }

    if (text !== original) {
      fs.writeFileSync(file, text);
      console.log(`updated ${file}`);
      changed += 1;
    }
  }
}

console.log(`Source files changed: ${changed}`);
console.log(`Language replacements: ${replacementsMade}`);
