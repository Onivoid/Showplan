# Voice (sound human)

Map copy is read by owners and teammates. It must be accurate **and** sound like a person wrote it, not a chatbot.

This is the **hard gate** for every string you write into the map: `architecture.json`, `descriptions/*.json`, tour, flows, recent-work, Ask answers, export-sanitize overlays, and Health locale overlays. Keep every claim. Do not invent facts. Match the map language.

Apply the same bar as the humanizer skill: strip AI patterns before you save. The build also replaces em/en dashes in map prose as a safety net; do not rely on that. Write clean copy the first time.

## Do

- Short, concrete sentences. Lead with the job: "Keeps unpaid orders aside until the card clears."
- Everyday words when `audience` is everyone. Technical terms only when they are the clearest word, or when `audience` is developers.
- Uneven rhythm is fine: one short line after a longer one.
- Say what the code does *today*, including placeholders.
- Ordinary punctuation only: comma, period, colon, parentheses, or a plain hyphen in ranges (`2020-2021`).

## Don't (common AI tells)

- Inflated importance: "pivotal", "crucial", "seamless", "robust", "comprehensive", "leverages", "streamlines".
- Sales gloss: "nestled", "vibrant", "cutting-edge", "delightful experience".
- Filler: "It is important to note that", "In order to", "serves as", "plays a key role".
- Groups of three for show: "fast, reliable, and scalable" with no evidence.
- **Em dashes (—) or en dashes (–)** anywhere in map prose. Never. Use a comma, period, or colon instead.
- Chatbot closers ("I hope this helps", "Let me know if…").
- Restating the heading in the first sentence.

## Before you save

Re-read the strings you wrote. If you spot a `—`, a sales word, or a stock AI opener, rewrite that sentence. Then save.

## Health and UI

Health titles and details follow the same voice in the map language. Prefer "Anyone who knows the address can change orders" over abstract security jargon, still precise about the risk.

Product names and protocols stay in their usual form (Stripe, HTTP, RLS).
