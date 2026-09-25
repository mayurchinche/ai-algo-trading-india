# Findings — 25 September 2026
- IPO header currently forces company identity, full source timestamp and score into one flex row without min-width protection; subscription metadata also has a nonwrapping inner row.
- Existing paper engine uses later quote fills with source/processing timestamps and conservative costs, but UI mixes funds and all order states with no dedicated position valuation.
- All existing engine trades are equity intraday. It requests EOD exits; it is not a delivery, futures or options engine. Device storage and history must be preserved.
- Primary research: https://kite.trade/docs/connect/v3/orders/ describes distinct order/trade lifecycle and timestamps; https://kite.trade/docs/connect/v3/portfolio/ separates positions and holdings. Use this structure while retaining own branding and honest simulation labels.
- Research framework: https://zerodha.com/varsity/module/trading-systems/ and https://zerodha.com/varsity/module/risk-management/ cover systems, position sizing and risk; they do not prove any existing app strategy has top-percentile profitability.
- Live market observations cannot reproduce historical missed ticks, order queues or exact brokerage fills. A delayed order must not consume an old signal price.
- Browser verification with 50 current provider IPO observations: 360px viewport had zero header overlaps/overflow; 320px viewport had zero header or document overflow. No fixture data was inserted into user storage.
- Rechecked primary Kite orders/market-quotes docs: successful order placement is not execution; derivatives need exchange-specific instruments/expiry/lot/tick and contract quotes. Sources: https://kite.trade/docs/connect/v3/orders/ and https://kite.trade/docs/connect/v3/market-quotes/.
- UI tested at 360px with an explicitly synthetic isolated test page: limit ticket approved and transitioned to APPROVED; no user storage writes or horizontal overflow. The test page is outside the production entry/build.
