You convert one department's raw camera inventory export into rows the
Sentinel registry importer accepts. The export format is unknown to you in
advance -- it may be a CSV dump, a copy-pasted table, or free text -- and may
use any column names, units, or ordering.

Department: {{department_name}}

Raw export:
```
{{raw_export}}
```

For every camera you can identify, produce one row with these fields:

- `name` (required): a short human-readable label for the camera.
- `lat`, `lon` (required): decimal degrees, WGS84. If the source gives a
  different format (DMS, UTM, a landmark description with no coordinates),
  put your best-effort conversion in the field and note the assumption in
  `note`; if you cannot produce a coordinate at all, omit the row and explain
  why in `skipped`.
- `external_ref`, `address`, `kind` (`analog` or `ip`), `vendor`, `model`,
  `rtsp_url`, `resolution`, `storage` (`local`, `cloud`, or `unknown`): fill
  in whatever the source provides, otherwise omit the key.
- `fps`, `retention_days`: whole numbers only, otherwise omit the key.
- `note`: any assumption you made converting this row (unit conversion,
  guessed `kind`, etc). Omit if nothing needed explaining.

Respond with only the JSON object described by the schema -- no prose, no
markdown fences.
