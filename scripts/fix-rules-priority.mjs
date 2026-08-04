/**
 * Adds the missing `priority` attribute to the scheduling_rules collection.
 * Run: node scripts/fix-rules-priority.mjs YOUR_API_KEY
 */
import { Client, Databases } from 'node-appwrite';

const ENDPOINT    = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID  = '6a5ac65d000f4a62b039';
const DATABASE_ID = 'timesync-db';
const API_KEY     = process.argv[2];

if (!API_KEY) {
  console.error('Usage: node scripts/fix-rules-priority.mjs YOUR_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

console.log('Adding priority attribute to scheduling_rules…');
try {
  // createIntegerAttribute(dbId, colId, key, required, min, max, default)
  await db.createIntegerAttribute(DATABASE_ID, 'scheduling_rules', 'priority', false, 1, 200, 50);
  console.log('✅ priority attribute created — wait ~10 seconds then reload the app.');
} catch (e) {
  if (e.code === 409) {
    console.log('⏭  priority already exists — it may have been added with wrong settings.');
    console.log('   Delete it in Appwrite Console → scheduling_rules → Attributes → priority → Delete');
    console.log('   Then re-run this script.');
  } else {
    console.error('❌ Failed:', e.message);
  }
}
