# WhatsMyName-derived data — CC BY-SA 4.0

Entries in `catalog.generated.json` with `"source": "wmn"` are adapted from
[WhatsMyName](https://github.com/WebBreacher/WhatsMyName)
(`wmn-data.json`, commit `062bcfe48df79fa618e96edc79dc9673f3fe5643`),
Copyright (C) 2015-2026 Micah Hoffman, licensed under the Creative Commons
Attribution-ShareAlike 4.0 International License
(https://creativecommons.org/licenses/by-sa/4.0/).

Changes: fields renamed into Handle Hub's normalized schema
(`uri_check` → `probeUrl`, `e_code`/`e_string` → `existsCodes`/`existsMarkers`,
`m_code`/`m_string` → `missingCodes`/`missingMarkers`, `{account}` → `{u}`),
categories mapped, NSFW flagged, and entries filtered by our self-test.

The adapted WhatsMyName entries are shared under the same license
(CC BY-SA 4.0). Sherlock- and Maigret-derived entries are MIT licensed (see
`THIRD_PARTY.md`). `selftest.json` contains only Handle Hub's own test results.
