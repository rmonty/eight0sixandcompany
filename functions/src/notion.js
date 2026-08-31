const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

const notionHeaders = (apiKey) => ({
  Authorization: `Bearer ${apiKey}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
})

const richText = (value) => [{ text: { content: String(value ?? '').slice(0, 2000) } }]

const formatItemsList = (items = []) =>
  items.map((item) => `${item.quantity}x ${item.name} — $${Number(item.price || 0).toFixed(2)}`).join('\n')

// Maps a Firestore order document into Notion page properties.
// Kept in sync with the database schema in ARCHITECTURE-PLAN.md §3.7.
const buildOrderProperties = (order) => ({
  'Order ID': { title: [{ text: { content: order.id } }] },
  'Customer Name': { rich_text: richText(order.customer?.name) },
  'Customer Email': { email: order.customer?.email || null },
  'Customer Phone': { phone_number: order.customer?.phone || null },
  Items: { rich_text: richText(formatItemsList(order.items)) },
  Total: { number: Number(order.total || 0) },
  'Payment Method': { select: order.paymentMethod ? { name: order.paymentMethod } : null },
  Status: { status: order.status ? { name: order.status } : null },
  Fulfillment: { select: order.fulfillmentMethod ? { name: order.fulfillmentMethod } : null },
  Source: { select: { name: order.isManual ? 'Manual' : 'Website' } },
  'Created At': { date: order.createdAt ? { start: new Date(order.createdAt).toISOString() } : null },
  Notes: { rich_text: richText(order.notes) },
  'Internal Notes': { rich_text: richText(order.internalNotes) },
})

export async function pushOrderToNotion(order, notionDatabaseId, notionApiKey) {
  const res = await fetch(`${NOTION_API_BASE}/pages`, {
    method: 'POST',
    headers: notionHeaders(notionApiKey),
    body: JSON.stringify({
      parent: { database_id: notionDatabaseId },
      properties: buildOrderProperties(order),
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion page create failed (${res.status}): ${text.slice(0, 500)}`)
  }

  return res.json()
}

export async function updateNotionPage(pageId, order, notionApiKey) {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(notionApiKey),
    body: JSON.stringify({ properties: buildOrderProperties(order) }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion page update failed (${res.status}): ${text.slice(0, 500)}`)
  }

  return res.json()
}

export async function archiveNotionPage(pageId, notionApiKey) {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(notionApiKey),
    body: JSON.stringify({ archived: true }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion page archive failed (${res.status}): ${text.slice(0, 500)}`)
  }

  return res.json()
}

// Sparse webhook events only carry a page id — fetch current property values.
export async function getNotionPage(pageId, notionApiKey) {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    headers: notionHeaders(notionApiKey),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion page fetch failed (${res.status}): ${text.slice(0, 500)}`)
  }

  return res.json()
}

// Handles both Notion select and native status property types.
export const readSelectProperty = (page, propertyName) => {
  const prop = page?.properties?.[propertyName]
  return prop?.select?.name || prop?.status?.name || ''
}

export const readRichTextProperty = (page, propertyName) =>
  (page?.properties?.[propertyName]?.rich_text || []).map((t) => t.plain_text || '').join('')
