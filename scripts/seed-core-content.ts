import { createDemoSeed, TEAM_ID } from "../src/domain/index.ts";
import { commitInChunks, services } from "./lib/admin.ts";

const { db } = services();
const seed = createDemoSeed();

const operations: Array<
  (batch: FirebaseFirestore.WriteBatch) => void
> = [];

const set = (path: string, value: unknown) => {
  operations.push((batch) => {
    batch.set(db.doc(path), value as FirebaseFirestore.DocumentData, {
      merge: true,
    });
  });
};

/*
 * Core production content only.
 * No synthetic users.
 * No fake athlete history.
 * No fake Practice Board entries.
 */

set(`teams/${TEAM_ID}`, seed.team);

set(
  `teams/${TEAM_ID}/seasons/${seed.season.id}`,
  seed.season
);

for (const item of seed.exampleBuckets) {
  set(
    `teams/${TEAM_ID}/exampleBuckets/${item.id}`,
    item
  );
}

for (const item of seed.curriculum) {
  set(
    `teams/${TEAM_ID}/curriculum/${item.id}`,
    item
  );
}

for (const item of seed.terms) {
  set(
    `teams/${TEAM_ID}/techniqueTerms/${item.id}`,
    item
  );
}

for (const item of seed.teamWins) {
  set(
    `teams/${TEAM_ID}/teamWins/${item.id}`,
    item
  );
}

for (const item of seed.challenges) {
  set(
    `teams/${TEAM_ID}/teamChallenges/${item.id}`,
    item
  );
}

await commitInChunks(operations, db);

console.log("");
console.log("Merrill core content seeded successfully.");
console.log(`Documents written: ${operations.length}`);
console.log(`YOU University lessons: ${seed.curriculum.length}`);
console.log(`Example buckets: ${seed.exampleBuckets.length}`);
console.log(`Technique terms: ${seed.terms.length}`);
console.log(`Team Wins: ${seed.teamWins.length}`);
console.log(`Team challenges: ${seed.challenges.length}`);
console.log("");
console.log("No synthetic athletes or private athlete data were created.");
