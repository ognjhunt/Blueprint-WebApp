# Blueprint Brand Polish QA Report

Generated: 2026-05-15T16:09:24.481Z
Base URL: http://127.0.0.1:4173
Command: `npm run qa:polish`
Boundary: local Playwright dev server only. No live sends, provider calls, payments, deploys, or Notion writes.

## Summary

- Route viewport checks: 22/22 passed.
- Internal link checks: 74/74 passed.
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
| / | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /about | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /capture | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /capture-app/launch-access?role=capturer&source=capture-hero | pass | 200 | /capture |
| /capture-app/launch-access?role=capturer&source=home-persona-capturer | pass | 200 | / |
| /careers | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact | pass | 200 | /contact |
| /contact/site-operator | pass | 200 | / |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Bayview+Micro-Fulfillment+Center&siteLocation=1380+Oakland+Rd%2C+San+Jose%2C+CA+95112&taskStatement=Pick+the+order+items+and+transfer+the+tote+to+pack&targetRobotTeam=AMR+with+shelf-facing+camera+and+tote+sensor | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Cherry+Creek+Hospital+Supply+Annex&siteLocation=950+Josephine+St%2C+Denver%2C+CO+80206&taskStatement=Load+the+cart%2C+deliver+to+the+room%2C+and+return+through+the+clear+corridor&targetRobotTeam=Hospital+cart+robot+with+head+cam+and+map+state+feed | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Commonwealth+Pharmacy+Refill+Center&siteLocation=71+Southampton+St%2C+Boston%2C+MA+02118&taskStatement=Pick+the+refill+item%2C+verify+it%2C+and+load+the+secure+bin&targetRobotTeam=Dual-arm+pharmacy+assistant+with+wrist+cam+and+barcode+state | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Front+Range+Cold+Storage+Pod&siteLocation=1911+Groveport+Rd%2C+Columbus%2C+OH+43207&taskStatement=Pick+the+target+bin+and+transfer+it+without+breaking+the+route+timing&targetRobotTeam=Cold-room+picker+with+arm+camera+and+thermal+state+feed | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Harborview+Grocery+Distribution+Annex&siteLocation=1847+W+Fulton+St%2C+Chicago%2C+IL+60612&taskStatement=Walk+to+shelf+staging+and+pick+the+blue+tote&targetRobotTeam=Unitree+G1+with+head+cam+and+wrist+cam | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Meadowlands+Returns+Processing+Suite&siteLocation=500+Duncan+Ave%2C+Jersey+City%2C+NJ+07306&taskStatement=Triage+the+returned+item+and+route+it+to+the+correct+tote&targetRobotTeam=Stationary+arm+with+table+cams+and+barcode+reader | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Media+Room+Demo+Walkthrough&siteLocation=Blueprint+hosted+review+demo&taskStatement=Media+room&targetRobotTeam=Mobile+manipulator+with+head+and+wrist+cameras | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Motor+City+Battery+Staging+Cell&siteLocation=7440+Lynch+Rd%2C+Detroit%2C+MI+48234&taskStatement=Move+the+part+feed+into+the+fixture+and+complete+the+transfer&targetRobotTeam=Assembly+arm+with+force+trace+stream+and+wrist+camera | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Newark+Terminal+B+Baggage+Feed&siteLocation=3+Brewster+Rd%2C+Newark%2C+NJ+07114&taskStatement=Scan+the+bag%2C+route+it+correctly%2C+and+clear+the+lane&targetRobotTeam=Bag-handling+arm+with+feed+camera+and+scan+event+stream | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Peachtree+Parcel+Exchange+South&siteLocation=2550+Lakewood+Ave+SW%2C+Atlanta%2C+GA+30315&taskStatement=Induct+a+parcel%2C+clear+the+lane%2C+and+reset+the+tote+position&targetRobotTeam=Mobile+manipulator+with+mast+cam+and+overhead+assist+view | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Sonoran+Assembly+Cart+Bay&siteLocation=4025+E+University+Dr%2C+Phoenix%2C+AZ+85034&taskStatement=Fetch+the+staged+cart+and+deliver+it+to+the+resupply+station&targetRobotTeam=Autonomous+cart+tug+with+front+stereo+pair | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Soundside+Electronics+Rework+Lab&siteLocation=2211+4th+Ave+S%2C+Seattle%2C+WA+98134&taskStatement=Fetch+the+tray+and+hand+the+part+to+the+rework+bench&targetRobotTeam=Bench-side+arm+with+wrist+cams+and+tray+state+sensor | pass | 200 | /world-models |
| /contact?interest=data-licensing&buyerType=robot_team&source=site-worlds&path=package-access&siteName=Trinity+Linen+Operations+Hub&siteLocation=1410+Irving+Blvd%2C+Dallas%2C+TX+75207&taskStatement=Lift+the+intake+bag%2C+sort+it%2C+and+transfer+the+load+to+outbound&targetRobotTeam=Humanoid+with+head+cam+and+top-down+supervisor+view | pass | 200 | /world-models |
| /contact?persona=robot-team | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact?persona=robot-team&buyerType=robot_team&interest=capture-access&path=request-capture&source=contact-fast-path | pass | 200 | /contact |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=contact-fast-path | pass | 200 | /contact |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing | pass | 200 | /pricing |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing-hero | pass | 200 | /pricing |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product | pass | 200 | /product |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product-bottom | pass | 200 | /product |
| /contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=proof-bottom | pass | 200 | /proof |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-bottom | pass | 200 | /proof |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-hero | pass | 200 | /proof |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=about-bottom | pass | 200 | /about |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=about-hero | pass | 200 | /about |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=contact-fast-path | pass | 200 | /contact |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=faq-bottom | pass | 200 | /faq |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=faq-hero | pass | 200 | /faq |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=header | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-bottom&utm_source=homepage&utm_medium=website&utm_campaign=home_robot_team_conversion_v1&utm_content=proof_pack%3Ahome-bottom | pass | 200 | / |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-decision-path&utm_source=homepage&utm_medium=website&utm_campaign=home_robot_team_conversion_v1&utm_content=proof_pack%3Ahome-decision-path | pass | 200 | / |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-hero-primary&utm_source=homepage&utm_medium=website&utm_campaign=home_robot_team_conversion_v1&utm_content=proof_pack%3Ahome-hero-primary | pass | 200 | / |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-persona-robot-team | pass | 200 | / |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-product-review | pass | 200 | / |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing | pass | 200 | /pricing |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing-hero | pass | 200 | /pricing |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds | pass | 200 | /world-models |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=world-models-hero | pass | 200 | /world-models |
| /contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=world-models-section | pass | 200 | /world-models |
| /faq | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /governance | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /help | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /pricing | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /privacy | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /product | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /proof | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /samples/sample-hosted-review-report.md | pass | 200 | /product |
| /signup/capturer | pass | 200 | /capture |
| /terms | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /updates | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /world-models | pass | 200 | /, /about, /capture, /careers, /contact, /faq, /pricing, /product, /proof, /updates, /world-models |
| /world-models/siteworld-f5fd54898cfb | pass | 200 | /, /pricing, /world-models |
| /world-models/siteworld-f5fd54898cfb/start | pass | 200 | /world-models |
| /world-models/sw-atl-02 | pass | 200 | /world-models |
| /world-models/sw-bos-08 | pass | 200 | /world-models |
| /world-models/sw-chi-01 | pass | 200 | /, /world-models |
| /world-models/sw-chi-01/start | pass | 200 | /world-models |
| /world-models/sw-col-05 | pass | 200 | /world-models |
| /world-models/sw-dal-04 | pass | 200 | /world-models |
| /world-models/sw-den-11 | pass | 200 | /world-models |
| /world-models/sw-det-09 | pass | 200 | /world-models |
| /world-models/sw-ewr-10 | pass | 200 | /world-models |
| /world-models/sw-jer-06 | pass | 200 | /world-models |
| /world-models/sw-phx-03 | pass | 200 | /world-models |
| /world-models/sw-sea-12 | pass | 200 | /world-models |
| /world-models/sw-sjc-07 | pass | 200 | /, /world-models |

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
