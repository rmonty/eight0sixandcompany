// One-time script: touches updatedAt on all unsynced orders so the
// syncOrderToNotion Firestore trigger fires and pushes them to Notion.
//
// Run with:
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json node scripts/backfill-notion.js
// or from a machine already authenticated via `gcloud auth application-default login`:
//   node scripts/backfill-notion.js
//
// Dry-run mode (lists orders without touching them):
//   DRY_RUN=1 node scripts/backfill-notion.js

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const DRY_RUN = process.env.DRY_RUN === '1'

async function main() {
  const snapshot = await db.collection('orders').get()
  const orders = snapshot.docs

  const unsynced = orders.filter((doc) => !doc.data().notionPageId)
  const alreadySynced = orders.length - unsynced.length

  console.log(`Total orders: ${orders.length}`)
  console.log(`Already synced: ${alreadySynced}`)
  console.log(`To sync: ${unsynced.length}`)

  if (unsynced.length === 0) {
    console.log('Nothing to do.')
    return
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — orders that would be touched:')
    unsynced.forEach((doc) => {
      const d = doc.data()
      console.log(`  ${doc.id}  ${d.customer?.name || ''}  $${d.total || 0}`)
    })
    return
  }

  console.log('\nTouching orders to trigger syncOrderToNotion...')

  // Process in batches of 10 to avoid hammering Notion API concurrently
  const BATCH = 10
  for (let i = 0; i < unsynced.length; i += BATCH) {
    const chunk = unsynced.slice(i, i + BATCH)
    await Promise.all(
      chunk.map((doc) =>
        doc.ref.update({ updatedAt: Date.now() }).then(() => {
          const d = doc.data()
          console.log(`  touched ${doc.id}  ${d.customer?.name || ''}`)
        }),
      ),
    )
    // Small pause between batches so Notion isn't flooded
    if (i + BATCH < unsynced.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log('\nDone. Check Cloud Functions logs for sync progress:')
  console.log('  firebase functions:log --only syncOrderToNotion')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
