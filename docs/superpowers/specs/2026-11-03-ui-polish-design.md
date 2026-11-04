# UI Polish Design

## Intent

Address the non-login frontend audit findings without changing authentication, data, APIs, roles, or portal selection.

## Scope

- Generate hover styles only for hover-capable pointers.
- Give shared buttons exact-property transitions and a `scale-96` enabled press state.
- Contain scrolling in shared dialogs and drawers.
- Replace the global context-menu `transition: all` declaration.

## Non-goals

- Do not change the pre-login staff selectors, account identifiers, authentication flows, or backend APIs.
- Do not mechanically rewrite every feature-local control.
