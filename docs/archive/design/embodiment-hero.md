# Manipulation embodiments and method page

Owner-directed follow-through to the site-led website. ADP-010 / partner-proof day 7: make the partner-intake method discoverable and welcome robotics teams across manipulation embodiments without claiming universal runtime support or physical validation.

`/how-it-works` is a real, prerendered page. Header links and the homepage's method link open it directly. The compact homepage steps remain expandable.

The hero cycles through four generated illustrative scenes: fixed Franka Panda-style arm, Figure 03-inspired bipedal humanoid, wheeled humanoid, and a mobile base with a Franka Panda-style arm. All depict manipulation tasks. Quadruped inspection is excluded at the owner's direction. No manufacturer relationship or tested deployment is claimed.

The 6.5-second scene dwell uses a gentle crossfade and small horizontal/scale transition. Copy and page dimensions stay fixed. Selecting a scene pauses rotation. An explicit play/pause control is available, keyboard focus pauses rotation, and the timer stops while the hero is offscreen or the document is hidden. Reduced-motion preference disables automatic rotation and transitions while retaining manual selection. Only loaded scenes can become active.

Images were generated through the Codex built-in image tool, with the approved original artwork and user-provided humanoid image as references. Requested model: GPT-Image-2.5 Sunburst; the available tool does not expose a selector or return model identity, so exact Sunburst provenance is unverified. Full prompts and generated source names are in `embodiment-hero-assets.json`. Final assets live in `client/public/images/site-led/embodiments/`.

The cookie banner's colors/type were matched to the current public theme after browser inspection exposed the previous dark theme. Its consent options and persistence behavior are unchanged.

Verification covers the real navigation destination, all four scene controls, layout stability, automatic rotation and pause, reduced motion, mobile overflow, prerendering, sitemap/crawler discovery, and existing intake flows. The architecture-map refresh remains unavailable because the installed Python environment lacks graphify; no refreshed graph is claimed.
