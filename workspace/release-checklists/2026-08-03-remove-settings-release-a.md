# PLAN_015 Release A migration checklist

Do not run these commands merely by merging or deploying Release A. Each target
deployment requires explicit release authorization. Do not paste document
contents, credentials, or other secrets into this checklist.

## Per-deployment gate

- [ ] Deploy the Release A schema and behavior changes.
- [ ] Dry-run the users cleanup:
      `pnpm --filter=@feel-good/convex exec convex run migrations:run '{"fn":"migrations/removeSettings:clearUserCustomization","dryRun":true}'`
- [ ] Record dry-run result: Not run.
- [ ] Run the users cleanup without `dryRun`.
- [ ] Record completion status: Not run.
- [ ] Run configuration thread cleanup:
      `pnpm --filter=@feel-good/convex exec convex run chat/legacyConfigurationCleanup:cleanupNext`
- [ ] Verify cleanup:
      `pnpm --filter=@feel-good/convex exec convex run chat/legacyConfigurationCleanup:verify`
- [ ] Confirm `configurationRowsRemain` is `false`.
- [ ] Run the surviving clone-mode cleanup:
      `pnpm --filter=@feel-good/convex exec convex run migrations:run '{"fn":"migrations/removeSettings:clearLegacyCloneMode","dryRun":true}'`
- [ ] Record dry-run result: Not run.
- [ ] Run the clone-mode cleanup without `dryRun`.
- [ ] Confirm both verification booleans are `false`.
- [ ] Confirm the migrations component reports both migrations complete.

## Release B authorization

- [ ] Every target deployment has completed the gate above.
- [ ] Release owner explicitly authorizes schema narrowing.
- [ ] Delete the feature-specific migration, cleanup, verifier, legacy mode
      classifier, `users/defaultProfileSection.ts`, optional schema fields, and
      temporary `conversations.by_mode` index.
