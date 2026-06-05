# Robot Video Source Candidates

Date: 2026-06-04

Input: attached conversation notes plus the follow-up Arena-G1 viewing context from this thread.

Scope: source/video candidates for possible Blueprint public-site use. This file is a review sheet only. No third-party media has been downloaded, copied into `client/public/`, clipped, or approved for production use.

## Review Standard

- Prefer material that can be downloaded, self-hosted, and attributed cleanly.
- Treat YouTube, NVIDIA blog embeds, GitHub release attachments, and project-page videos as link/embed candidates unless a license or rights holder explicitly permits clipping, editing, or self-hosting.
- Label all third-party simulation media as third-party simulation/evaluation context. It is not Blueprint capture proof, customer proof, provider execution proof, robot safety validation, or deployment-readiness proof.
- For the current public-site wedge, humanoid robot visuals are preferred when they fit the page, but proof/technical sections can use manipulator-arm videos when they explain scenario evaluation or sim-first validation better than a humanoid clip.

## Best Immediate Candidate

### 1. NVIDIA Arena-G1-Loco-Manipulation-Task

Best use: small robot-POV inset, dashboard loop, or "what an eval episode looks like" module.

Why it matters: this is the closest fit to Blueprint's episode/scenario language. It is a Hugging Face dataset from NVIDIA with G1 humanoid loco-manipulation trajectories, state/vision/language/action context, and first-person RGB MP4 episode videos.

Links:

- Dataset card: https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task
- README/source card: https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/blob/main/README.md
- Video folder: https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/tree/main/lerobot/videos/chunk-000/observation.images.ego_view
- Example file page: https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/blob/main/lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4
- Direct example download: https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/resolve/main/lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4?download=true

Download one episode:

```bash
hf download nvidia/Arena-G1-Loco-Manipulation-Task \
  lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4 \
  --repo-type dataset \
  --local-dir ./arena-g1-videos
```

Download all visible episode MP4s:

```bash
hf download nvidia/Arena-G1-Loco-Manipulation-Task \
  --repo-type dataset \
  --include "lerobot/videos/chunk-000/observation.images.ego_view/*.mp4" \
  --local-dir ./arena-g1-videos
```

Rights posture: strongest candidate for self-hosting after attribution. The dataset card lists `cc-by-4.0`, says the dataset is ready for commercial use, and says there are 50 RGB MP4 videos.

Attribution if used:

> Video source: NVIDIA Arena-G1-Loco-Manipulation-Task dataset, CC-BY-4.0.

Caveats:

- First-person POV, not a third-person hero shot.
- 256 x 256 MP4s, so use as a small UI/inset loop, not full-width hero media.
- Synthetic Isaac Lab/Arena footage; do not present as Blueprint capture proof.

## Strong Visual Candidate, Permission Needed

### 2. Isaac Lab v2.3.0 release: G1 Locomanipulation Pick Place

Best use: possible hero background only if permission/license clarity is resolved. Otherwise link in a proof/reference section.

Links:

- Release page: https://github.com/isaac-sim/IsaacLab/releases/tag/v2.3.0
- G1 locomanipulation pick/place attachment: https://github.com/user-attachments/assets/d6e70e09-9a41-4292-ac9d-0ec41f6e3a1b
- G1 locomanipulation navigation attachment: https://github.com/user-attachments/assets/c9724e48-e76a-4343-9ad3-de01c922a395
- Dex cube attachment from same release: https://github.com/user-attachments/assets/89cce6ef-a029-4705-8ef7-9ad5efee6320
- Dex rod attachment from same release: https://github.com/user-attachments/assets/7c897ae8-3ad6-499c-b873-63898be5d761
- IsaacLab license: https://github.com/isaac-sim/IsaacLab/blob/main/LICENSE

Rights posture: medium. The IsaacLab repository code is BSD-3-Clause, but the release videos and Isaac Sim assets/dependencies may have separate terms. Do not clip, edit, or self-host as a site hero until permission/asset terms are checked.

Caveats:

- Simulated, not Blueprint-produced.
- Good humanoid visual fit, but not a real warehouse/customer proof asset.

## Good Official Proof Links

### 3. NVIDIA Smart Pick-and-Place in Isaac Sim

Best use: lower-page proof link or embedded YouTube player showing sim-first industrial pick/place validation. Not a humanoid hero.

Links:

- Blog page: https://developer.nvidia.com/blog/automating-smart-pick-and-place-with-intrinsic-flowstate-and-nvidia-isaac-manipulator/
- Video 1, "Smart Pick-and-Place in NVIDIA Isaac Sim": https://www.youtube.com/embed/paLR6-hjlT8
- Video 2, "Grasping skill, based on an NVIDIA foundation model, used in Intrinsic Flowstate": https://www.youtube.com/embed/9j9G8yEXI_g
- Video 3, "Pick-and-Place for Machine Tending in NVIDIA Isaac Sim": https://www.youtube.com/embed/hXrfH7ysNPY

Rights posture: link/embed only unless NVIDIA grants permission for clipping/self-hosting.

Caveats:

- Manipulator arm, not humanoid.
- Good for "sim-first validation exists in the market" copy, not for Blueprint-specific proof.

### 4. NVIDIA IsaacLab Arena and LeRobot documentation

Best use: technical proof/citation for policy evaluation, GPU-accelerated rollouts, cameras, and video recording.

Links:

- LeRobot docs: https://huggingface.co/docs/lerobot/en/envhub_isaaclab_arena
- Current/main docs variant: https://huggingface.co/docs/lerobot/main/en/envhub_isaaclab_arena
- IsaacLab Arena env hub: https://huggingface.co/nvidia/isaaclab-arena-envs
- NVIDIA Isaac Lab-Arena page: https://developer.nvidia.com/isaac/lab-arena

Rights posture: high for linking/citation. It is documentation, not production media.

Caveats:

- Use this to support "recorded rollouts/scenario evaluation" concepts.
- Do not treat docs as proof that Blueprint has run policy evaluation.

### 5. DextrAH-RGB

Best use: training/repeated-grasp proof section or internal inspiration. Not the main hero.

Links:

- Project page: https://dextrah-rgb.github.io/
- Code: https://github.com/NVlabs/DEXTRAH
- arXiv: https://arxiv.org/abs/2412.01791
- Teaser/project video path: https://dextrah-rgb.github.io/static/videos/dextrah_new_arch_resnet18_seed3_comp.mp4
- RGB training video path: https://dextrah-rgb.github.io/static/videos/training_video_v3_3fast.mp4
- Stereo RGB input video path: https://dextrah-rgb.github.io/static/videos/stereo_video.mp4
- Embedded YouTube video: https://www.youtube.com/embed/8LSoElooyJM
- NVIDIA R2D2 blog mentioning DextrAH-RGB: https://developer.nvidia.com/blog/r2d2-adapting-dexterous-robots-with-nvidia-research-workflows-and-models/

Rights posture: medium. The project page says the website is Creative Commons Attribution-ShareAlike 4.0, but verify whether that applies cleanly to the video assets before clipping or self-hosting. BY-SA can impose share-alike obligations on derivatives.

Caveats:

- Dexterous grasping, not site-specific warehouse pick/place.
- More academic/research visual than buyer-facing facility evaluation.

### 6. NVIDIA GR00T N1.6

Best use: inspiration/proof link for humanoid policy rollouts and Unitree G1 locomanipulation. Link to the page or embed through the page experience; do not self-host without permission.

Links:

- Research page: https://research.nvidia.com/labs/gear/gr00t-n1_6/
- GitHub: https://github.com/NVIDIA/Isaac-GR00T/tree/main
- Model card: https://huggingface.co/nvidia/GR00T-N1.6-3B/

Direct HLS media paths exposed by the page bundle:

- Main policy rollout: https://research.nvidia.com/labs/gear/n1_6/hsl/oneshot_2.5x_mited.m3u8
- Unitree G1, place mug into rack: https://research.nvidia.com/labs/gear/n1_6/hsl/g1_place_mug_in_rack.m3u8
- Unitree G1, pick Doritos from cart: https://research.nvidia.com/labs/gear/n1_6/hsl/g1_pick_up_doritos_from_cart.m3u8
- Unitree G1, pick eraser from drawer: https://research.nvidia.com/labs/gear/n1_6/hsl/g1_pick_eraser_from_drawer.m3u8
- Unitree G1, place shoe in box: https://research.nvidia.com/labs/gear/n1_6/hsl/g1_place_shoe_in_box.m3u8
- Unitree G1, pick apple/place basket: https://research.nvidia.com/labs/gear/n1_6/hsl/g1_pick_apple_place_basket.m3u8

Rights posture: medium-low for reuse. Good official page to link. HLS paths are public page assets, not a license grant.

Caveats:

- Strong humanoid fit, but licensing/use needs review.
- HLS `.m3u8` paths may require a player that supports HLS.

### 7. Isaac Sim UR10 Bin Stacking

Best use: technical "example task pack" inspiration for conveyor/bin/pallet logic.

Links:

- Current docs: https://docs.isaacsim.omniverse.nvidia.com/4.5.0/cortex_tutorials/tutorial_cortex_5_ur10_bin_stacking.html
- Tutorial 9 basic pick/place: https://docs.isaacsim.omniverse.nvidia.com/latest/robot_setup_tutorials/tutorial_pickplace_example.html

Rights posture: link/citation only.

Caveats:

- Tutorial content, not a clean embeddable marketing clip.
- Manipulator arm, not humanoid.

## Lower-Confidence YouTube/Community Items

Use these for inspiration or official-player embedding only. Do not clip/download/self-host without permission.

### Isaac Sim and Isaac Lab: Full Guide to Building and Training Robots

Links:

- NVIDIA Isaac Sim community highlights page listing the video: https://docs.isaacsim.omniverse.nvidia.com/latest/reference_material/community_highlights.html
- Direct video from that docs page: https://youtu.be/tQziqSx-F80

Rights posture: embed/link only. Community project, not an NVIDIA-owned site asset unless separately confirmed.

### Simulation took Control of my Robot Arm (NVIDIA Isaac Sim)

Links:

- Class Central page: https://www.classcentral.com/course/youtube-simulation-took-control-of-my-robot-arm-nvidia-isaac-sim-425759

Rights posture: embed/link only if the YouTube page is recovered. The direct YouTube URL was not exposed by the page fetch in this session.

### Bin Picking Simulation Using Isaac Sim

Status: exact source from the note was not resolved to a reliable direct URL. Similar bin-picking/Isaac Sim material appeared in forums and community posts, but nothing was clean enough to recommend for public-site media from this pass.

Review terms:

- Search query: `"Bin Picking Simulation Using Isaac Sim" "YouTube"`
- Search query: `"bin picking" "NVIDIA Isaac Sim" "youtube"`

### What's New in Isaac Lab | Robotics Office Hours

Status: exact direct video URL was not resolved in this pass. Treat as a source to search manually on NVIDIA Developer/YouTube if a long-form proof link is useful.

Review terms:

- Search query: `"What's New in Isaac Lab" "Robotics Office Hours"`
- Search query: `"NVIDIA Robotics Office Hours" "Isaac Lab"`

## Recommended Site Stack

1. Use NVIDIA Arena-G1 first for a small self-hosted robot-POV dashboard loop, with attribution and synthetic/third-party labeling.
2. Review the IsaacLab v2.3.0 G1 locomanipulation attachments as the best third-person humanoid hero candidate, but only self-host/clip after permission or clear asset terms.
3. Link/embed the NVIDIA Smart Pick-and-Place videos in a proof section to show industrial sim-first pick/place evaluation.
4. Link LeRobot/IsaacLab-Arena docs in technical proof copy when explaining scenarios, rollouts, and recorded evaluation video.
5. Keep DextrAH-RGB and GR00T N1.6 as research/proof links or inspiration unless legal/permission review clears direct reuse.

## Copy Boundary For Any Use

Safe labels:

- "Third-party simulation example"
- "Representative policy-evaluation footage"
- "Robot POV from an open dataset"
- "Synthetic Isaac Lab episode"
- "External reference, not Blueprint capture proof"

Avoid:

- "Blueprint ran this policy"
- "Customer deployment"
- "Safety validated"
- "Ready to deploy"
- "Real-site result"
- "Captured by Blueprint"

## Next Actions

1. Open the Arena-G1 video folder and download 3-5 episodes for visual review.
2. Pick one clean Arena-G1 episode for a dashboard-style loop if it reads well at small size.
3. Open the IsaacLab v2.3.0 G1 GitHub attachments in browser and decide whether they justify a permission request.
4. If a hero needs third-person humanoid footage, request reuse permission from the relevant rights holder before editing/self-hosting.
5. Keep all non-Blueprint videos out of public proof claims unless the page explicitly labels them as external/reference media.
