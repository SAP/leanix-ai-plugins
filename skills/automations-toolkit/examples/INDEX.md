# Examples Index

Centralized catalog of 29 automation scripts

---

## Quick Reference by Category

| Category                                              | Count | Purpose                                                                |
| ----------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| [basic](#basic)                                       | 1     | Simple starter scripts for learning                                    |
| [tagging](#tagging)                                   | 5     | Automatically add/remove tags based on fields, relations, or documents |
| [subscription-inheritance](#subscription-inheritance) | 3     | Propagate subscriptions from one fact sheet to related fact sheets     |
| [subscription-management](#subscription-management)   | 3     | Modify subscription types, count roles                                 |
| [relation-creation](#relation-creation)               | 1     | Auto-create relations based on fact sheet attributes                   |
| [relation-management](#relation-management)           | 2     | Update relation attributes (e.g., risk status)                         |
| [relation-propagation](#relation-propagation)         | 3     | Propagate relations from child to parent fact sheets                   |
| [transitive-relations](#transitive-relations)         | 2     | Auto-create relations through an intermediary fact sheet               |
| [lifecycle-management](#lifecycle-management)         | 1     | React to lifecycle phase changes                                       |
| [initiative-management](#initiative-management)       | 1     | Sync fields based on related initiative statuses                       |
| [data-processing](#data-processing)                   | 1     | Conditional field updates and defaults                                 |
| [lifecycle-actions](#lifecycle-actions)               | 1     | Archive or status change automations                                   |
| [api-calls](#api-calls)                               | 1     | External API integration patterns                                      |
| [notifications](#notifications)                       | 1     | Dynamic email notifications via To-Do API                              |
| [reports](#reports)                                   | 1     | ToDo creation and reporting                                            |
| [archive](#archive)                                   | 1     | Archive fact sheets after lifecycle events                             |
| [utilities](#utilities)                               | 1     | Validation and helper scripts                                          |

---

## All Scripts

### basic

Simple scripts for getting started with LeanIX automations.

| Script                                 | Complexity | Trigger                    | Description                                                                                        |
| -------------------------------------- | ---------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| [hello-world.js](basic/hello-world.js) | Beginner   | Fact Sheet Created/Updated | Adds a "HELLO_WORLD" tag to any fact sheet. Demonstrates basic tag manipulation and return object. |

---

### tagging

Scripts that automatically manage tags based on various conditions.

| Script                                                                                    | Complexity   | Trigger                                      | Description                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [energy-consumption-tagging.js](tagging/energy-consumption-tagging.js)                    | Intermediate | Field value changed (energyConsumptionLevel) | Tags ITComponents with T-shirt size (XS/S/M/L/XL) based on energy consumption ranges. Demonstrates numeric-to-tag mapping and mutually exclusive tags.                                    |
| [relation-based-tagging.js](tagging/relation-based-tagging.js)                            | Intermediate | Relation added/removed                       | Tags Applications based on linked ITComponent types (Server/Database). Uses reconciliation pattern to handle both add and remove triggers.                                                |
| [document-sensitivity-tagging.js](tagging/document-sensitivity-tagging.js)                | Intermediate | Completion score changed                     | Scans attached documents and applies sensitivity tags (Architecture/Business/Security) based on document types. Demonstrates document API access.                                         |
| [risk-currency-app-trigger.js](tagging/risk-currency-rollup/risk-currency-app-trigger.js) | Advanced     | Relation added/removed (Application)         | Rolls up worst Risk Currency tag from linked ITCs to Application via return object. Part of 10-automation suite. See [folder README](tagging/risk-currency-rollup/README.md).             |
| [risk-currency-itc-trigger.js](tagging/risk-currency-rollup/risk-currency-itc-trigger.js) | Advanced     | Tag added/removed (ITComponent)              | Updates linked Applications when ITC Risk Currency tag changes via GraphQL mutation with retry. Part of 10-automation suite. See [folder README](tagging/risk-currency-rollup/README.md). |

---

### subscription-inheritance

Scripts that propagate subscriptions across relations.

| Script                                                                          | Complexity | Trigger                                                     | Description                                                                                                                                          |
| ------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [app-owner-to-itc.js](subscription-inheritance/app-owner-to-itc.js)             | Advanced   | Subscription added/removed, Relation added (on Application) | Full reconciliation: syncs "Application Owner" role from Application to all related ITComponents. Creates/removes subscriptions as needed.           |
| [itc-owner-cleanup.js](subscription-inheritance/itc-owner-cleanup.js)           | Advanced   | Relation removed (on ITComponent)                           | Cleanup companion: reconciles inherited subscriptions when an Application is unlinked. Handles the case where removed relation is no longer visible. |
| [app-owner-to-interface.js](subscription-inheritance/app-owner-to-interface.js) | Advanced   | Subscription added/removed, Relation added (on Application) | Add-only: propagates "Application Owner" subscriptions to linked Interfaces. Does not remove on unsubscribe.                                         |

---

### subscription-management

Scripts that modify subscriptions based on events.

| Script                                                                               | Complexity   | Trigger                                                          | Description                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [eol-subscriber-downgrade.js](subscription-management/eol-subscriber-downgrade.js)   | Intermediate | Lifecycle state reached (End of Life)                            | Downgrades all RESPONSIBLE subscribers to OBSERVER when a fact sheet reaches End of Life phase. Demonstrates subscription type modification. |
| [subscription-role-counter.js](subscription-management/subscription-role-counter.js) | Intermediate | Subscription added/removed, Completion score changed             | Counts total subscriptions on an Application and updates a custom field. Useful for enforcing minimum subscription requirements.             |
| [it-app-owner-guard.js](subscription-management/it-app-owner-guard.js)               | Intermediate | Subscription added (Application, RESPONSIBLE, IT App Owner role) | Enforces a single IT App Owner per Application. Keeps the oldest subscription and deletes duplicates when more than one exists.              |

---

### relation-creation

Scripts that auto-create relations based on fact sheet attributes or naming patterns.

| Script                                                                         | Complexity | Trigger                                | Description                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [auto-link-itc-by-provider.js](relation-creation/auto-link-itc-by-provider.js) | Advanced   | Fact sheet is created (on Application) | Auto-creates relations to all ITComponents whose displayName matches a provider prefix (e.g., "Microsoft"). Demonstrates allFactSheets pagination and displayName usage. |

---

### relation-management

Scripts that update relation attributes.

| Script                                                                                 | Complexity | Trigger                                | Description                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [obsolescence-risk-calculator.js](relation-management/obsolescence-risk-calculator.js) | Advanced   | Application Updated                    | Calculates and sets `obsolescenceRiskStatus` on Application-to-ITComponent relations based on risk target dates and EOL status. Demonstrates relation attribute patching. |
| [link-app-to-microsoft-itc.js](relation-management/link-app-to-microsoft-itc.js)       | Advanced   | Fact sheet is created (on Application) | Auto-links new Applications to all Microsoft ITComponents. Demonstrates provider-based auto-linking pattern.                                                              |

---

### relation-propagation

Scripts that propagate relations to parent fact sheets. See the [folder README](relation-propagation/README.md) for complete setup instructions.

| Script                                                                              | Complexity | Trigger                                 | Description                                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [bc-propagate-to-parent.js](relation-propagation/bc-propagate-to-parent.js)         | Advanced   | Relation added/removed (on Application) | Propagates Business Context relations from child Applications to parent Applications. Marks inherited relations in description field.   |
| [bc-cleanup-on-child-unlink.js](relation-propagation/bc-cleanup-on-child-unlink.js) | Advanced   | Relation removed (on Application)       | Reconciles parent's Business Contexts when parent removes child link. Handles parent-side trigger.                                      |
| [bc-reconcile-all-parents.js](relation-propagation/bc-reconcile-all-parents.js)     | Advanced   | Relation removed (on Application)       | Catch-all: queries ALL parent Applications and reconciles each one. Handles child-side trigger when former parent is no longer visible. |

---

### transitive-relations

Scripts that auto-create relations through an intermediary fact sheet.

| Script                                                                                  | Complexity | Trigger                                         | Description                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [app-bc-context-sync.js](transitive-relations/app-bc-context-sync.js)                   | Advanced   | Relation added/removed (on Application)         | Auto-creates Application → Business Context relations based on Application → Business Capability → Business Context chain. Marks auto-created relations with [AUTO-BC-SYNC]. |
| [bc-propagate-context-to-apps.js](transitive-relations/bc-propagate-context-to-apps.js) | Advanced   | Relation added/removed (on Business Capability) | Same logic as above but triggered from the Business Capability side. Updates all linked Applications when BC changes.                                                        |

---

### lifecycle-management

Scripts that react to lifecycle phase changes. See the [folder README](lifecycle-management/README.md) for setup details.

| Script                                                                    | Complexity | Trigger                                                   | Description                                                                                                                           |
| ------------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [bc-eol-break-app-seal.js](lifecycle-management/bc-eol-break-app-seal.js) | Advanced   | Lifecycle state reached (End of Life on Business Context) | Breaks the quality seal on all related Applications when a Business Context reaches End of Life. Forces Application owners to review. |

---

### initiative-management

Scripts that sync fields based on related initiative statuses.

| Script                                                                                             | Complexity | Trigger                                              | Description                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [initiative-status-permission-sync.js](initiative-management/initiative-status-permission-sync.js) | Advanced   | Field value changed (initiativeStatus on Initiative) | Multi-relation tie-breaker: sets Application permission based on ALL linked Initiative statuses. Any blocked/frozen → no; all active → yes. |

---

### data-processing

Scripts for conditional field updates.

| Script                                                           | Complexity | Trigger                     | Description                                                                                                                  |
| ---------------------------------------------------------------- | ---------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [filter-applications.js](data-processing/filter-applications.js) | Beginner   | Application Created/Updated | Sets default lifecycle if missing, adds review tag if EOL within 1 year. Demonstrates conditional logic and date comparison. |

---

### lifecycle-actions

Scripts that change fact sheet status (archive, activate, etc.).

| Script                                                   | Complexity   | Trigger   | Description                                                                                                       |
| -------------------------------------------------------- | ------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| [archive-on-tag.js](lifecycle-actions/archive-on-tag.js) | Intermediate | Tag Added | Archives fact sheet with comment when specific tag is added. Demonstrates status mutation with idempotency check. |

---

### notifications

Scripts that send dynamic email notifications to computed recipients.

| Script                                                                     | Complexity   | Trigger                                   | Description                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dynamic-todo-notification.js](notifications/dynamic-todo-notification.js) | Intermediate | Field value changed (businessCriticality) | Creates To-Do for RESPONSIBLE subscribers when businessCriticality changes. LeanIX automatically emails assignees. Demonstrates dynamic recipient computation and To-Do upsert with externalId for idempotency. |

---

### api-calls

Scripts demonstrating external API integration.

| Script                                                 | Complexity   | Trigger            | Description                                                                                                                |
| ------------------------------------------------------ | ------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [fetch-fact-sheets.js](api-calls/fetch-fact-sheets.js) | Intermediate | Fact Sheet Updated | Basic GraphQL query pattern. Fetches fact sheet data and appends timestamp to description. Template for API-based scripts. |

---

### reports

Scripts for creating ToDos and reports.

| Script                                             | Complexity   | Trigger             | Description                                                                                      |
| -------------------------------------------------- | ------------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| [lifecycle-report.js](reports/lifecycle-report.js) | Intermediate | Application Updated | Creates ToDo items for Applications in phaseOut or endOfLife phase. Demonstrates ToDo API usage. |

---

### archive

Scripts that archive fact sheets after lifecycle events.

| Script                                                                     | Complexity | Trigger                                                     | Description                                                                                                               |
| -------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [archive-initiative-after-eol.js](archive/archive-initiative-after-eol.js) | Advanced   | Lifecycle phase reached (endOfLife + 30 days on Initiative) | Archives Initiative with comment 30 days after reaching End of Life. Demonstrates status mutation with idempotency check. |

---

### utilities

Validation and helper scripts.

| Script                                           | Complexity | Trigger                    | Description                                                                                                                                    |
| ------------------------------------------------ | ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [data-validator.js](utilities/data-validator.js) | Beginner   | Fact Sheet Created/Updated | Validates required fields, checks for prohibited tags, aborts with error if validation fails. Demonstrates abort pattern and validation logic. |

---

## Scripts by Complexity

### Beginner (3 scripts)

Good for learning the basics. Minimal API calls, simple logic.

1. [hello-world.js](basic/hello-world.js) - Tag manipulation basics
2. [filter-applications.js](data-processing/filter-applications.js) - Conditional logic, dates
3. [data-validator.js](utilities/data-validator.js) - Validation, abort pattern

### Intermediate (10 scripts)

Moderate complexity. GraphQL queries, reconciliation basics.

1. [energy-consumption-tagging.js](tagging/energy-consumption-tagging.js) - Numeric to tag mapping
2. [relation-based-tagging.js](tagging/relation-based-tagging.js) - Reconciliation pattern
3. [document-sensitivity-tagging.js](tagging/document-sensitivity-tagging.js) - Document API
4. [fetch-fact-sheets.js](api-calls/fetch-fact-sheets.js) - GraphQL basics
5. [lifecycle-report.js](reports/lifecycle-report.js) - ToDo API
6. [dynamic-todo-notification.js](notifications/dynamic-todo-notification.js) - Dynamic notifications
7. [eol-subscriber-downgrade.js](subscription-management/eol-subscriber-downgrade.js) - Subscription updates
8. [subscription-role-counter.js](subscription-management/subscription-role-counter.js) - Count pattern
9. [archive-on-tag.js](lifecycle-actions/archive-on-tag.js) - Status mutation
10. [it-app-owner-guard.js](subscription-management/it-app-owner-guard.js) - Single subscription guard

### Advanced (16 scripts)

Complex logic. Multi-step mutations, full reconciliation, revision tracking.

1. [app-owner-to-itc.js](subscription-inheritance/app-owner-to-itc.js) - Full subscription sync
2. [itc-owner-cleanup.js](subscription-inheritance/itc-owner-cleanup.js) - Cleanup companion
3. [app-owner-to-interface.js](subscription-inheritance/app-owner-to-interface.js) - Add-only Interface sync
4. [auto-link-itc-by-provider.js](relation-creation/auto-link-itc-by-provider.js) - Auto-create relations by provider
5. [obsolescence-risk-calculator.js](relation-management/obsolescence-risk-calculator.js) - Relation attributes
6. [link-app-to-microsoft-itc.js](relation-management/link-app-to-microsoft-itc.js) - Provider-based auto-linking
7. [initiative-status-permission-sync.js](initiative-management/initiative-status-permission-sync.js) - Tie-breaker
8. [bc-eol-break-app-seal.js](lifecycle-management/bc-eol-break-app-seal.js) - Quality seal
9. [app-bc-context-sync.js](transitive-relations/app-bc-context-sync.js) - Transitive relations
10. [bc-propagate-context-to-apps.js](transitive-relations/bc-propagate-context-to-apps.js) - BC-side trigger
11. [bc-propagate-to-parent.js](relation-propagation/bc-propagate-to-parent.js) - Parent propagation
12. [bc-cleanup-on-child-unlink.js](relation-propagation/bc-cleanup-on-child-unlink.js) - Child unlink
13. [bc-reconcile-all-parents.js](relation-propagation/bc-reconcile-all-parents.js) - Full reconciliation
14. [risk-currency-app-trigger.js](tagging/risk-currency-rollup/risk-currency-app-trigger.js) - Risk Currency rollup (return object)
15. [risk-currency-itc-trigger.js](tagging/risk-currency-rollup/risk-currency-itc-trigger.js) - Risk Currency rollup (mutation)
16. [archive-initiative-after-eol.js](archive/archive-initiative-after-eol.js) - Archive after EOL

---

## Finding the Right Script

| I want to...                                   | Use this script                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Auto-link to fact sheets by name/provider      | [auto-link-itc-by-provider.js](relation-creation/auto-link-itc-by-provider.js)                     |
| Add a tag based on a field value               | [energy-consumption-tagging.js](tagging/energy-consumption-tagging.js)                             |
| Add a tag based on related fact sheets         | [relation-based-tagging.js](tagging/relation-based-tagging.js)                                     |
| Roll up worst tag from related fact sheets     | [risk-currency-app-trigger.js](tagging/risk-currency-rollup/risk-currency-app-trigger.js)          |
| Add a tag based on attached documents          | [document-sensitivity-tagging.js](tagging/document-sensitivity-tagging.js)                         |
| Copy subscriptions to related fact sheets      | [app-owner-to-itc.js](subscription-inheritance/app-owner-to-itc.js)                                |
| Copy subscriptions to Interfaces (add-only)    | [app-owner-to-interface.js](subscription-inheritance/app-owner-to-interface.js)                    |
| Downgrade subscribers at end of life           | [eol-subscriber-downgrade.js](subscription-management/eol-subscriber-downgrade.js)                 |
| Enforce single subscription role cardinality   | [it-app-owner-guard.js](subscription-management/it-app-owner-guard.js)                             |
| Update a relation attribute                    | [obsolescence-risk-calculator.js](relation-management/obsolescence-risk-calculator.js)             |
| Create relations through intermediary          | [app-bc-context-sync.js](transitive-relations/app-bc-context-sync.js)                              |
| Propagate relations to parent                  | [bc-propagate-to-parent.js](relation-propagation/bc-propagate-to-parent.js)                        |
| React to lifecycle phase change                | [bc-eol-break-app-seal.js](lifecycle-management/bc-eol-break-app-seal.js)                          |
| Handle multiple related items with tie-breaker | [initiative-status-permission-sync.js](initiative-management/initiative-status-permission-sync.js) |
| Validate data before saving                    | [data-validator.js](utilities/data-validator.js)                                                   |
| Set default field values                       | [filter-applications.js](data-processing/filter-applications.js)                                   |
| Archive a fact sheet on tag                    | [archive-on-tag.js](lifecycle-actions/archive-on-tag.js)                                           |
| Archive a fact sheet after EOL                 | [archive-initiative-after-eol.js](archive/archive-initiative-after-eol.js)                         |
| Create ToDo items                              | [lifecycle-report.js](reports/lifecycle-report.js)                                                 |
| Send dynamic email notifications               | [dynamic-todo-notification.js](notifications/dynamic-todo-notification.js)                         |
| Make a basic GraphQL call                      | [fetch-fact-sheets.js](api-calls/fetch-fact-sheets.js)                                             |
| Start with the simplest example                | [hello-world.js](basic/hello-world.js)                                                             |
