---
'@backstage/plugin-catalog-react': minor
---

Update the EntityOwnerPicker to update the available Owners based on the selected Entity kind

- Added new prop `selectedKind` to the `useFetchEntities` hook
- refactored `useFacetEntities` to return the EntityOwners on every kind change
- refactored the `useQuerryEntities` hook
- adjusted some tests to reflect the changes
