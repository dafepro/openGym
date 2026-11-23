# 014 — Invite-only hosted Coach

Uplift builds the existing openGym coaching payload in the browser after consent. The droplet runs the existing proposal validator. The lifter reviews changes before applying them.

```mermaid
flowchart LR
  B[Browser: workouts, editable notes, recent chat] -->|Selected context| A[Google via Cloudflare Access]
  A --> W[Uplift Worker] --> T[Private tunnel]
  T --> S[Shared droplet: verify identity and reserve quota]
  S -->|Fixed model, store false| O[OpenAI]
  O --> S -->|Validated proposal| B
```

Open **Plan → Coach → Notes** to edit up to 600 characters. Full profile backups and sync include notes and chat. The origin persists usage counts only. Deploy owns the invite list, tunnel and provider credential.
