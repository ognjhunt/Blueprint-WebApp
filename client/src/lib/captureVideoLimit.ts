/**
 * The upload limit for a site's video, shared by the start form, the job page and the upload route.
 *
 * The largest video the upload route takes: its `SELF_CAPTURE_MAX_UPLOAD_BYTES` default (2 GiB,
 * `server/routes/self-capture-uploads.ts`). A larger file is refused before any byte is sent, so a site is not left
 * waiting for gigabytes to upload only to be told the upload could not be confirmed.
 */
export const MAX_CAPTURE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

/** What the site reads when its video is over the limit, on the form and from the server (413, `video_too_large`). */
export const VIDEO_TOO_LARGE = "This video is too large to send. Film one round of the job in a shorter clip, or record at 1080p, and send that.";
