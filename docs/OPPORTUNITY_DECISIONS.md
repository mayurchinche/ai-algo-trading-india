# Opportunity decision cards

Implemented locally on 26 September 2026; not deployed or included in the published APK.

The opportunity API now returns a separate current decision map for only the signals on the requested page. Original signal events and their timestamps remain unchanged. Decisions come from the same account snapshot and carry its revision. No matching intent or order is explicitly unknown, not assumed tradable.

Home, Signals and Alerts cards show recorded rejection/cancellation reasons, review status, submitted orders, partial fills, open positions and closed trades. A submitted order is not labelled as a fill. Closed-trade net P&L and costs are exposed only after closure; unknown values remain unknown. Monitoring gaps remain visible. An expired reference does not erase an existing order or position.

Added symbol search and decision filters over the latest 100 loaded signals, evidence/timestamp disclosure, a reference-expiry countdown and navigation to the corresponding paper controls from Signals and Alerts as well as Home. Full immutable signal history remains exportable; current decision state is not backdated into historical exports.

Validation: 113 automated tests, five SQL suites, TypeScript/Vite production build and lint passed. Tests cover account-scoped projection, immutable observations, missing decisions, partial/closed status precedence, expiry and exact rejection reasons. An isolated local fixture at phone width verified blocked, partial and closed cards and the closed-trade filter. Synthetic fixture data was not added to production source, storage or API.

No new strategy, profitability claim, trading permission or database migration is introduced. The backend response is additive; older APKs can ignore the new fields. A web deployment and rebuilt APK are required to display the new cards everywhere.
