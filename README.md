# mkevents

Reads events out of the places venues actually publish them: an Instagram
poster, a venue's own website, a cinema's programme.

Fetching and parsing only. Nothing here touches a database, a queue or an HTTP
server — every function returns plain data for the caller to persist, which is
what lets the same code serve a website, a worker or a one-off script.

**This is a private package.** It is installed from this repository, not from
the public registry, where the name `mkevents` belongs to someone else.

```jsonc
// package.json
"dependencies": {
  "mkevents": "github:Vangel22/mkevents"
}
```

## Using it

Credentials are arguments, not environment variables, so the caller decides
where its secrets come from. Each option falls back to the matching environment
variable when it is left out, which is convenient and never required.

```ts
import { scrapeInstagramProfile, parseEventFromPost, readEventsFromPage } from 'mkevents';

const posts = await scrapeInstagramProfile('@mirage__club', { token: apifyToken });

const parsed = await parseEventFromPost(post.imageUrl, post.caption, post.timestamp, {
  apiKey: anthropicKey,
  primaryModel: 'claude-sonnet-5',
  escalationModel: 'claude-opus-5',
});

const published = await readEventsFromPage('https://a-venue.mk/events', { type: 'club' });
```

### What each reader is for

| | source | model involved |
|---|---|---|
| `scrapeInstagramProfile` | Apify, public profiles | none |
| `parseEventFromPost` | a poster image plus its caption | yes — this is the hard part |
| `readEventsFromPage` | schema.org `Event` data on a venue's site | none, it is already structured |
| `fetchMovies` / `fetchScreenings` | a cinema's own API | none |
| `isAllowed` | robots.txt, honoured before any page read | none |

## On the model

Reading a poster needs a model that handles the script the poster is written
in. Sonnet reads Macedonian Cyrillic correctly where cheaper models drop the Ќ
diacritic and alter grammatical endings — which shows on the most visible field
of every listing. Opus is asked only about the uncertain tail, where a wrong
reading is most likely; set `escalationModel` equal to `primaryModel` to turn
that off.

Everything else here parses structured data and needs no model at all.
