# Scheduling Analysis of UAV Flight-Control Workloads on PREEMPT_RT Linux — Raspberry Pi 4 Replication

Web edition of the report *“Scheduling Analysis of UAV Flight Control Workloads on
PREEMPT_RT Linux — Replication on Raspberry Pi 4 with 4 GB RAM”* (Testing &amp; Verification
Project Proposal, October 2026), built as a cinematic data dossier in the style of
daotrunganhvt72.github.io/ky-hop-1976, restyled for a real-time-systems theme.

Single static page — `index.html` + `cinema.css` + `app.js` + `cinema.js`, no build step.
All measured numbers shown are **Raspberry Pi 5 reference data** from Giacomossi et al.,
arXiv:2604.19275 — no Pi 4 data exist yet.

## Chapters

1. The cost of being late — real-time classes, research questions
2. Implementation stages M0 → M6 (scroll-driven timeline + gallery)
3. Reference results from Pi 5 — interactive latency chart (3 modes) + deadline ruler
4. Inside one task cycle — rₖ / sₖ / fₖ timing diagram synced to scroll
5. Eight scheduling configurations — tabbed browser with Pi 5 reference numbers
6. The platform — Pi 4 vs Pi 5
7. Hypotheses and limits
8. Field manual — five terminals of commands from the report appendix
9. Open dossier — 14 references, figure credits, CSV download

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000
```
