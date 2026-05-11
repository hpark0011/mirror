# Graphify Effectiveness Reports

Generate the current local report with:

```bash
node scripts/measure-graphify-effectiveness.mjs --days 14 --format html --out workspace/reports/graphify-effectiveness/latest.html
node scripts/measure-graphify-effectiveness.mjs --days 14 --format json --out workspace/reports/graphify-effectiveness/latest.json
```

`latest.*` files are intentionally ignored because their graph freshness fields
refer to the commit that was current at generation time.
