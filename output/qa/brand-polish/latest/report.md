# Blueprint Brand Polish QA Report

Generated: 2026-07-17T14:20:41.460Z
Base URL: http://127.0.0.1:4173
Command: `npm run qa:polish`
Boundary: local Playwright dev server only. No live sends, provider calls, payments, deploys, or Notion writes.

## Summary

- Route viewport checks: 24/24 passed.
- Internal link checks: 50/50 passed.
- Notion layout checklist: `output/qa/brand-polish/latest/notion-layout-checklist.md`

## Issues

- No blocking issues found.

## Route And Screenshot Matrix

| Route | Viewport | Status | Screenshot | Failed checks |
|---|---:|---:|---|---|
| / | desktop | pass | `output/qa/brand-polish/latest/screenshots/home-desktop.png` | none |
| / | mobile | pass | `output/qa/brand-polish/latest/screenshots/home-mobile.png` | none |
| /product | desktop | pass | `output/qa/brand-polish/latest/screenshots/product-desktop.png` | none |
| /product | mobile | pass | `output/qa/brand-polish/latest/screenshots/product-mobile.png` | none |
| /world-models | desktop | pass | `output/qa/brand-polish/latest/screenshots/world-models-desktop.png` | none |
| /world-models | mobile | pass | `output/qa/brand-polish/latest/screenshots/world-models-mobile.png` | none |
| /agents | desktop | pass | `output/qa/brand-polish/latest/screenshots/agents-desktop.png` | none |
| /agents | mobile | pass | `output/qa/brand-polish/latest/screenshots/agents-mobile.png` | none |
| /pricing | desktop | pass | `output/qa/brand-polish/latest/screenshots/pricing-desktop.png` | none |
| /pricing | mobile | pass | `output/qa/brand-polish/latest/screenshots/pricing-mobile.png` | none |
| /proof | desktop | pass | `output/qa/brand-polish/latest/screenshots/proof-desktop.png` | none |
| /proof | mobile | pass | `output/qa/brand-polish/latest/screenshots/proof-mobile.png` | none |
| /capture | desktop | pass | `output/qa/brand-polish/latest/screenshots/capture-desktop.png` | none |
| /capture | mobile | pass | `output/qa/brand-polish/latest/screenshots/capture-mobile.png` | none |
| /contact | desktop | pass | `output/qa/brand-polish/latest/screenshots/contact-desktop.png` | none |
| /contact | mobile | pass | `output/qa/brand-polish/latest/screenshots/contact-mobile.png` | none |
| /careers | desktop | pass | `output/qa/brand-polish/latest/screenshots/careers-desktop.png` | none |
| /careers | mobile | pass | `output/qa/brand-polish/latest/screenshots/careers-mobile.png` | none |
| /faq | desktop | pass | `output/qa/brand-polish/latest/screenshots/faq-desktop.png` | none |
| /faq | mobile | pass | `output/qa/brand-polish/latest/screenshots/faq-mobile.png` | none |
| /about | desktop | pass | `output/qa/brand-polish/latest/screenshots/about-desktop.png` | none |
| /about | mobile | pass | `output/qa/brand-polish/latest/screenshots/about-mobile.png` | none |
| /updates | desktop | pass | `output/qa/brand-polish/latest/screenshots/updates-desktop.png` | none |
| /updates | mobile | pass | `output/qa/brand-polish/latest/screenshots/updates-mobile.png` | none |

## Internal Link Matrix

| Href | Status | HTTP status | Source routes |
|---|---:|---:|---|
| / | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /capture | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact/robot-team | pass | 200 | /agents, /careers, /contact |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=footer | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=header | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home | pass | 200 | /, /about, /product, /updates |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Front%20Range%20Cold%20Storage%20Pod&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Harborview%20Grocery%20Distribution%20Annex&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Lakeshore%20Loading%20Dock&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Motor%20City%20Battery%20Staging%20Cell&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Northfield%20Distribution%20Center&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Piedmont%20Hospital%20Supply%20Hallway&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=South%20Bay%20Retail%20Stockroom&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=Triangle%20Robotics%20Lab&source=sites-card | pass | 200 | /world-models |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=proof | pass | 200 | /faq, /proof |
| /contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=sites-hero | pass | 200 | /world-models |
| /contact/site-operator | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact/site-operator?buyerType=site_operator&requestedOutputs=Site%20Monitoring%20Subscription&source=pricing | pass | 200 | /pricing |
| /contact/site-operator?buyerType=site_operator&requestedOutputs=Site%20Supply%20Review&source=pricing | pass | 200 | /pricing |
| /contact/site-operator?source=sites-hero | pass | 200 | /world-models |
| /contact?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&requestedOutputs=Quick-Look%20Eval&episodeCount=50&source=pricing | pass | 200 | /pricing |
| /contact?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription&source=pricing | pass | 200 | /pricing |
| /contact?persona=robot-team&interest=policy-evaluation-run&source=pricing | pass | 200 | /pricing |
| /for-robot-teams | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /for-site-operators | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /how-it-works | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /pricing | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /privacy | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /proof | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /sign-in | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /signup/capturer?intent=waitlist&source=capture-jobs | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=austin-market-aisle | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=chicago-pharmacy-supply | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=denver-cold-storage | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=durham-dock-staging | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=phoenix-assembly-cart | pass | 200 | /capture |
| /signup/capturer?source=capture-jobs&job=seattle-rework-lab | pass | 200 | /capture |
| /signup?flow=capturer | pass | 200 | /agents, /careers, /contact |
| /sites | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /sites/lakeshore-loading-dock | pass | 200 | /world-models |
| /sites/northfield-distribution-center | pass | 200 | /world-models |
| /sites/piedmont-hospital-supply-hallway | pass | 200 | /world-models |
| /sites/south-bay-retail-stockroom | pass | 200 | /world-models |
| /sites/sw-chi-01 | pass | 200 | /world-models |
| /sites/sw-col-05 | pass | 200 | /world-models |
| /sites/sw-det-09 | pass | 200 | /world-models |
| /sites/triangle-robotics-lab | pass | 200 | /world-models |
| /terms | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /vision | pass | 200 | /, /about, /agents, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |

## Checks Covered

- Desktop and mobile screenshots for key public buyer routes.
- Blank page, framework overlay, H1, route heading, and visible text checks.
- Basic SEO: title, meta description, robots, and canonical URL.
- Basic accessibility: image alt text, interactive names, and visible form labels.
- Mobile layout: horizontal overflow guard.
- Asset sanity: visible image decode/natural-size guard.
- CTA presence and href contract for primary route actions.
- Public Launch Ready posture guard for broad prelaunch, apology, placeholder, and backend-incomplete copy on public routes.
- Broken internal link check over visible same-origin links.
- Console errors after filtering known local dev-server, Firebase persistence, and React Helmet dev warnings.
