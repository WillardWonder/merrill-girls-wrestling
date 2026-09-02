import fs from "node:fs";
import path from "node:path";

const TARGETS = [
  "src/features",
  "src/app",
  "src/domain/seedContent.ts"
];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const HARD = [
  ["clinical disclaimer", /\bnot therapy\b/i],
  ["clinical disclaimer", /\bnot a mental health tool\b/i],
  ["clinical disclaimer", /\bnot treatment\b/i],
  ["EMDR leakage", /\bEMDR\b/i],
  ["internal product wording", /manufacture a task/i],
  ["database-state wording", /no practice is open/i],
  ["raw Firebase error", /\bFirebaseError\b/i],
  ["raw permission error", /missing or insufficient permissions/i],
  ["raw undefined error", /unsupported field value:\s*undefined/i],
  ["rejected Merrill terminology", /\brun[- ]pipe\b/i],
];

const REVIEW = [
  ["avoidance instruction", /\bdon['’]?t\b/i],
  ["avoidance instruction", /\bdo not\b/i],
  ["absolute wording", /\bnever\b/i],
  ["failure framing", /\bfail(?:ed|ure|ing)?\b/i],
  ["generic hype", /\byou got this\b/i],
  ["generic hype", /\bbelieve in yourself\b/i],
  ["generic hype", /\bstay positive\b/i],
  ["body-image wording", /\bbody image\b/i],
  ["appearance wording", /\bappearance\b/i],
  ["weight wording", /\bweight\b/i],
  ["clinical wording", /\btherapy\b/i],
  ["clinical wording", /\btrauma\b/i],
  ["clinical wording", /\bdiagnos(?:e|is|tic)\b/i],
];

function walk(target) {
  if (!fs.existsSync(target)) return [];

  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];

  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = [...new Set(TARGETS.flatMap(walk))];
const hard = [];
const review = [];

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, i) => {
    for (const [label, re] of HARD) {
      if (re.test(line)) hard.push(`${file}:${i + 1}: ${label}: ${line.trim()}`);
    }

    for (const [label, re] of REVIEW) {
      if (re.test(line)) review.push(`${file}:${i + 1}: ${label}: ${line.trim()}`);
    }
  });
}

console.log("");
console.log("ATHLETE LANGUAGE AUDIT");
console.log("======================");

if (review.length) {
  console.log("");
  console.log("REVIEW FLAGS");
  console.log("These are contextual checks, not automatic failures.");
  for (const item of review) console.log(`  ${item}`);
}

if (hard.length) {
  console.log("");
  console.log("HARD FAILURES");
  for (const item of hard) console.log(`  ${item}`);
  console.log("");
  console.error(`FAILED: ${hard.length} known athlete-language leak(s) remain.`);
  process.exit(1);
}

console.log("");
console.log("PASS: No known athlete-facing clinical, product, Firebase, or rejected-language leaks found.");
