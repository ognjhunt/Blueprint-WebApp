import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description = "A limited, invited beta for real sites and tasks. Get a free initial assessment grounded in the evidence you share.";

export default function Beta() {
  return (
    <>
      <SEO title="Beta program | Blueprint" description={description} canonical="/beta" jsonLd={[
        webPageJsonLd({ path: "/beta", name: "Blueprint beta program", description }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Beta program", path: "/beta" }]),
      ]} />
      <article className="ms-legal ms-container">
        <p className="ms-eyebrow">Beta program</p>
        <h1>Start with one real task.</h1>
        <p>We’re inviting a limited group of sites and robot teams to help shape Blueprint around real work. The starting point is a useful initial task assessment, grounded in the evidence you share.</p>
        <section>
          <h2>What do I provide?</h2>
          <p>Bring a recurring task at a real site, the outcome you want, and a short video you have permission to share or a conversation about the work. We’ll ask for feedback on the assessment and follow-up to clarify gaps or discuss next steps.</p>
        </section>
        <section>
          <h2>What do I receive?</h2>
          <p>Our goal is to help you get a suitable robot working on a real task at your site. We start by assessing whether robotics could help, what the evidence supports, and what still needs checking.</p>
          <p style={{ marginTop: "1em" }}>If there’s a promising fit and a suitable robot team is available, we can help connect you and work toward an on-site pilot. Scope, success criteria, responsibilities and costs are agreed separately before proceeding. An assessment doesn’t guarantee a robot or deployment.</p>
        </section>
        <section id="scope">
          <h2>What does it cost?</h2>
          <p>The initial assessment is free for invited participants. Any later evaluation, integration, or physical pilot has its scope and cost agreed separately before proceeding. Participating does not commit you to that work or include a free physical deployment.</p>
        </section>
        <section>
          <h2>What is experimental?</h2>
          <p>Task analysis and robot-fit recommendations are experimental and may need review or correction. There is no guaranteed ready robot, instant automatic delivery, or validated performance claim. An assessment or simulation is not proof of physical performance or safety.</p>
        </section>
        <section>
          <h2>What about robot teams?</h2>
          <p>Robot teams participate by invitation on a specific task. Any evaluation needs an agreed scope, permitted evidence, and a clear account of what the team can support. Joining does not guarantee an evaluation run, a customer introduction, or a deployment.</p>
        </section>
        <div className="ms-how-cta"><a className="ms-button" href="/contact/site-operator?source=beta">Discuss a task</a></div>
      </article>
    </>
  );
}
