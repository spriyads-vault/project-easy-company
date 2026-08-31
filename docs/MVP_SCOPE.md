# MVP Scope and Acceptance

## Pilot happy path
1. Sign in.
2. Open seed product “Gateway X”.
3. Product revision contains a 40 MHz clock, display path/cable, WiFi module and power context.
4. Create radiated-emissions failure case.
5. Enter 200 MHz, +7.4 dB, operating mode “WiFi TX + display active”.
6. Analysis streams structured progress.
7. A deterministic correlation can identify 40 MHz × 5 = 200 MHz.
8. UI shows ranked hypotheses with evidence labels and missing information.
9. Add observation: display disconnected, peak drops 9 dB.
10. Relevant hypothesis is updated as additional supporting evidence, without claiming certainty.
11. Record engineering change: display termination Rev17 → Rev18.
12. Enter new measurement: 200 MHz, -3.6 dB.
13. UI shows 11 dB improvement.
14. Product/evidence state records that the new result belongs to Rev18 and Rev17 evidence is historical.
15. Refresh page and case remains intact.

## Hard failure conditions
MVP is not done if:
- hypotheses are only free-form chatbot prose
- analysis state disappears on refresh
- user data is publicly accessible
- Crado states a definitive root cause without sufficient evidence
- uploaded material can be accessed across workspaces
- demo requires editing the database manually
