# Auth email templates

Supabase stores these in the dashboard, not in this repo, so they are kept
here to be version-controlled and reviewable. **Editing a file here changes
nothing** — paste it into the dashboard to take effect:

**Authentication → Emails → Templates**, then pick the matching tab.

| File | Dashboard tab | Sent to |
|---|---|---|
| [`confirm-signup.html`](confirm-signup.html) | Confirm signup | Someone signing in for the first time, who has no account yet |
| [`magic-link.html`](magic-link.html) | Magic Link | Someone who already has an account |

Both must be updated. It is easy to change only Magic Link and conclude
nothing happened, because *first-time* readers never see that one — Supabase
sends Confirm signup when no account exists.

## Why these don't use `{{ .ConfirmationURL }}`

The default template links to Supabase's `/auth/v1/verify` endpoint, which
redeems the one-time token on **any** GET request. University mail systems
routinely scan inbound links, and a scanner following the link burns the
token before the reader ever clicks it. The reader then sees "Email link is
invalid or has expired" on a link they never used — which is exactly what
happened on this project's first real sign-in attempt, from a `cmc.edu`
address whose mail was held for four minutes before delivery.

These templates instead link to the app's own `/auth/confirm` page carrying
`{{ .TokenHash }}`. That page redeems the token by calling `verifyOtp` in the
browser, so merely *fetching* the URL does nothing. Mail scanners do not
execute JavaScript, so the link survives them.

`src/app/auth/confirm/page.tsx` handles both link shapes, so reverting to the
defaults is safe if these ever need to be rolled back.

## Things that will break these

- **`{{ .SiteURL }}` must be set correctly** in Authentication → URL
  Configuration. It is the origin these links point at.
- **The `type` parameter must match the template.** `type=signup` in
  Confirm signup, `type=magiclink` in Magic Link. A mismatch produces the
  same "invalid or has expired" error as a spent token.
- Supabase templates are Go templates. A typo in a `{{ ... }}` tag can render
  as literal text or produce `#ZgotmplZ`, which silently breaks the link for
  everyone. Send yourself a test after any edit.
