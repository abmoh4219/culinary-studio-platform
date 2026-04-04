# Manual Verification Checklist

## Core Flows

- Sign in as member/admin and confirm secure cookie auth works.
- Create booking, fill capacity, then join waitlist with second and third users.
- Cancel booking and confirm waitlist promotion order is FIFO by queue position.
- Open recipe player and select recipe through searchable selector (no manual UUID typing).
- In admin workspace, update privacy preferences and consent record for a user.

## Security Controls

- Verify protected mutation without signed headers returns `401`.
- Verify signed mutation with mismatched canonical user sub returns `401`.
- Verify duplicate nonce replay returns `409`.
- Verify duplicate idempotency key replays cached response.

## Analytics Export e2e Assertion

- Navigate to `/dashboard` as admin.
- Click `Recipe View Volume CSV` export link.
- Assert response status is `200` and content type includes `text/csv`.
- Assert `Content-Disposition` includes `attachment` and filename `recipe_view_volume.csv`.
