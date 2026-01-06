# Marketing Suite

## Overview
The Marketing Suite lives at `/admin/marketing` and provides a Mailchimp-like workspace for campaigns, templates, audience, and automations.

## Email template compilation
Templates store both the visual editor state and a compiled HTML snapshot.

* **editorStateJson**: GrapesJS project data plus `html` + `css` (saved from the editor).
* **compiledHtml**: Email-safe HTML created on the server by combining HTML + CSS, inlining styles, sanitising risky scripts/handlers, and enforcing safe link targets.
* **compiledText**: Optional plain-text companion (currently `null`).

Compilation happens via:

```
POST /admin/api/marketing/templates/:id/compile
```

The server uses `backend/src/services/marketing/template-compiler.ts` to:

1. Combine HTML + CSS output from GrapesJS.
2. Inline CSS into elements.
3. Remove dangerous scripts/event handlers.
4. Enforce safe `target` + `rel` on links.

## Merge tags
Merge tags are rendered server-side at send time.

* Format: `{{contact.firstName}}`, `{{show.title}}`, `{{links.ticketLink}}`, etc.
* Unknown tags are replaced with an empty string.

The merge tag implementation lives in:

* `backend/src/lib/email-marketing/merge-tags.ts`

### Available groups
**Contact**
* `{{contact.firstName}}`
* `{{contact.lastName}}`
* `{{contact.email}}`
* `{{contact.town}}`
* `{{contact.county}}`
* `{{contact.tags}}`

**Show**
* `{{show.title}}`
* `{{show.venue}}`
* `{{show.date}}`
* `{{show.time}}`
* `{{show.priceFrom}}`
* `{{show.image}}`

**Links**
* `{{links.ticketLink}}`
* `{{links.managePreferencesLink}}`
* `{{links.unsubscribeLink}}`

## Adding new merge tags
1. Extend `buildDefaultMergeContext` in `backend/src/lib/email-marketing/merge-tags.ts`.
2. Update the merge tag dropdown list in `backend/public/static/marketing-suite.js`.
3. Ensure new values are populated in the API layer when sending tests or campaigns.

## Legacy MJML templates
`MarketingTemplate.mjmlBody` remains supported for legacy templates. If `compiledHtml` is missing, the system will fall back to MJML rendering.
