# Third-party data and code

Handle Hub's catalog engine (`lib/engine/`) checks 1,500+ sites using detection
rules harvested from three open-source OSINT projects. Their data is **not
vendored**: `npm run catalog` (also run automatically by `prebuild`) downloads
the pinned upstream files listed in `lib/engine/upstream.ts`, normalizes them
into `data/sites/catalog.generated.json` and keeps the upstream `source` and
`license` on every entry. Only our own self-test output
(`data/sites/selftest.json`, a list of definition ids) is committed.

| Project | What we use | License | Pinned commit |
| --- | --- | --- | --- |
| [WhatsMyName](https://github.com/WebBreacher/WhatsMyName) by Micah Hoffman & contributors | `wmn-data.json` site definitions (`uri_check`, `e_code`/`e_string`, `m_code`/`m_string`, `known`) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | `062bcfe48df79fa618e96edc79dc9673f3fe5643` |
| [Sherlock](https://github.com/sherlock-project/sherlock) by the Sherlock Project | `sherlock_project/resources/data.json` (`errorType`, `errorMsg`, `urlProbe`, `username_claimed`, `regexCheck`) | MIT | `e40a45ec2a074b90703b3b4b842c8a3adbd6ada3` |
| [Maigret](https://github.com/soxoj/maigret) by Soxoj & contributors | `maigret/resources/data.json` (`checkType`, `presenseStrs`/`absenceStrs`, `errors`, `usernameClaimed`, tags) | MIT | `d692810934c69e74acdbe24a0f464fd18eb4609b` |

## Share-alike (WhatsMyName)

Definitions derived from WhatsMyName remain under **CC BY-SA 4.0**. The
generated catalog is a separate data file (it is not mixed into the
application source code), every WMN-derived entry carries
`"source": "wmn", "license": "CC-BY-SA-4.0"`, and if you redistribute the
generated catalog you must do so under CC BY-SA 4.0 with attribution. See
`data/sites/LICENSE-WMN.md`.

## MIT notices (Sherlock, Maigret)

```
MIT License — Copyright (c) 2019 Sherlock Project
MIT License — Copyright (c) 2020-2026 Soxoj

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Rules adopted into hand-tuned adapters

| Adapter | Rule | Source |
| --- | --- | --- |
| X | `api.x.com/i/users/username_available.json` (signup availability) | WhatsMyName "X" |
| Xbox | `xboxgamertag.com/search/{u}` markers (`Games Played` / `Gamertag doesn't exist`) | WhatsMyName / Sherlock / Maigret "Xbox Gamertag" |
| Instagram | `www.instagram.com/api/v1/users/web_profile_info` with web app id + referer | Maigret "Instagram" |
| TikTok | regional block page detection (`Govt. of India decided to block`) | Sherlock "TikTok" |
| Discord | `unique-username/username-attempt-unauthed` (`{"taken":…}`) | Sherlock / WMN / Maigret |

Not adopted (by policy): rules that need a shared/guest bearer token or
session cookies (e.g. Maigret's Twitter guest-token flow), third-party
scrapers of other platforms (imginn, nitter mirrors, twitchtracker) and
archive.org "was archived" checks (they say nothing about current availability).

Other projects reviewed: [Blackbird](https://github.com/p1ngul1n0/blackbird)
(GPL-3.0 — not used, incompatible with copying into this codebase; its site list
is WhatsMyName-based anyway), [social-analyzer](https://github.com/qeeqbox/social-analyzer)
(AGPL-3.0 — not used), [Nexfil](https://github.com/thewhiteh4t/nexfil) (MIT — its URL list is a subset of the above).
