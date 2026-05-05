import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { exactSiteScopingCallUrl } from "@/lib/booking";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";

const reviewCards = [
  {
    title: "Book the call",
    body: "A narrow scoping pass on one real site, one workflow, and one deployment question.",
  },
  {
    title: "What to bring",
    body: "The site, the robot setup, and the exact question the team needs answered before travel or rollout spend.",
  },
  {
    title: "What it resolves",
    body: "Whether the next move is package access, hosted review, more scoping, or a custom request path.",
  },
];

export default function BookExactSiteReview() {
  return (
    <>
      <SEO
        title="Book Exact-Site Review Call | Blueprint"
        description="Book a Blueprint scoping call for exact-site world-model work, hosted evaluation, and site-package review."
        canonical="/book-exact-site-review"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.scopingRoom}
            alt="Book exact-site review"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel>Book the call</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  Book an exact-site scoping call.
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">
                  Use this page when one real site, one workflow, and one deployment question are ready for a focused scoping pass.
                </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-3">
            {reviewCards.map((card, index) => (
              <div
                key={card.title}
                className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
              >
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">
                  {card.title}
                </h2>
                <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-white/70" : "text-slate-600"}`}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Scoping"
                title="A good call resolves the next real move."
                description="The output is a tighter path, not a vague intro meeting."
              />
              <div className="mt-8 space-y-3 text-sm leading-7 text-slate-700">
                <div>Confirm the real facility and workflow.</div>
                <div>Clarify whether package, hosted review, or a custom path fits.</div>
                <div>Keep rights, privacy, and export considerations visible from the start.</div>
              </div>
            </div>
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Scheduling</p>
              <h2 className="font-editorial mt-4 text-[2.6rem] leading-[0.94] tracking-[-0.04em]">
                A narrow scoping pass on one real site.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Open the scheduler when the site and first review question are already clear. Use contact instead when rights, privacy, or scope still need sorting first.
              </p>
              <a
                href={exactSiteScopingCallUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-8 inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Open scheduling
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Use the call when one real site is already in view."
            description="If you still need public proof first, inspect the listing or the hosted-review page before opening a time slot."
            imageSrc={editorialGeneratedAssets.scopingRoom}
            imageAlt="Scoping room"
            primaryHref={exactSiteScopingCallUrl}
            primaryLabel="Book the call"
            secondaryHref="/exact-site-hosted-review"
            secondaryLabel="What a good scoping call resolves"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
