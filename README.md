# csv-reader-speed-01-run-20261121 entry

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/tngrha/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/tngrha/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0, the reference reader of the
[csv-reader-speed-01 bounty on make.fun](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
("Read broken CSV files faster, 21 November 2026").

- `solve.js` — an ES module whose `run(input)` returns exactly csv-reader 1.0.0's
  `{columns, rows, errors}` for every input `{text, header}`, under the same written
  broken-row policy (BOM drop, stray CRs, quote junk, unterminated quotes, short/long
  rows, line/row error positions). Where the reference reads one character at a time
  and builds each field by concatenation, this reader scans with `charCodeAt` and
  takes each field's value as one slice of the text, building segments only for the
  rare field that holds an escaped quote, a carriage return inside quotes, or a
  stray CR outside them.
- `main.ts` — the driver the harness runs (`node /bot/main.ts`, Node 22): reads every
  case from `/input/cases.json`, answers each with `run`, writes `/output/answers.json`.
  It turns V8's incremental marking off before importing `solve.js`, as the house
  baseline does.

Verified identical to csv-reader 1.0.0 on the competition's practice set and on
freshly drawn generated sets plus randomized broken-CSV fuzz cases; locally about
8-10x faster than the reference on the parsing itself.
