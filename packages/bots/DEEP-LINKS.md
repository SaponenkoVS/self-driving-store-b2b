# Grok Bot deep links

Not in use yet (we use a different auth flow for now). Kept for later.

A deep link opens Grok Bot with a message already filled in for a given bot. The user reviews it and sends it.

## Format

```
https://cursor.com/grok-bot/link/v1/prompt?id=<agent_id>&text=<message>
```

- `id`: the bot's Grok agent ID (`agt_…`). Required.
- `text`: the message. Required. Must be a single line of at most 1000 characters, URL-encoded.

The page then bounces to the app scheme:

```
grokbot://app/v1/prompt?id=<agent_id>&text=<message>
```

If the app doesn't open, the user has to open Grok Bot and pick the bot from their list.

## What we checked (2026-11-05)

| URL | Result |
|---|---|
| `?id=%3CbotId%3E&text=hi` (the template placeholder left in) | "This prompt link is not valid" |
| `?id=agt_test123&text=hello` | "Open this prompt in Grok Bot", with a bounce to `grokbot://…` |
| `?id=agt_test123` (no `text`) | "This prompt link is not valid" |

The page only checks the format. Whether the app opens the right bot for a real ID hasn't been tested yet.

## Building a link

```sh
# bun
bun -e 'const [id, text] = process.argv.slice(1); console.log(`https://cursor.com/grok-bot/link/v1/prompt?id=${encodeURIComponent(id)}&text=${encodeURIComponent(text.replace(/\s*\n\s*/g, " ").slice(0, 1000))}`)' agt_XXXX "Check today's negotiations"
```

```ts
export function grokPromptLink(agentId: string, text: string): string {
  const line = text.replace(/\s*\n\s*/g, " ").trim().slice(0, 1000);
  return `https://cursor.com/grok-bot/link/v1/prompt?id=${encodeURIComponent(agentId)}&text=${encodeURIComponent(line)}`;
}
```

## Bots to link (fill in the agent IDs)

The IDs are the same ones that go in `~/nsc/contacts.json` / `skills/gateway/routes.json`.

| Account | Bot | Agent ID |
|---|---|---|
| store | gateway | `agt_…` |
| store | customer-manager | `agt_…` |
| store | supplier-manager | `agt_…` |
| store | guard | `agt_…` |
| customer | buyer | `agt_…` |
