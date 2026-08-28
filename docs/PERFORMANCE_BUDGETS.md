# Performance budgets

Initial targets for a production-like desktop/mobile run: LCP < 2.5s, INP <
200ms, CLS < 0.1, zero console errors/warnings, and no blocking request waterfall
for the public shell. Keep the initial client island under 250KB compressed by
moving heavy authenticated surfaces behind dynamic boundaries; the current Next
build exceeds this and is a recorded optimization item.

Measure with Chrome DevTools performance trace and Lighthouse-equivalent checks;
do not claim a budget pass from a static build alone.
