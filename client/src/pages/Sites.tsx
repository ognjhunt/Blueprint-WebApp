import { SEO } from "@/components/SEO";
import { TaskBrowse } from "@/components/site/TaskBrowse";
export default function Sites() { return <>
  <SEO title="Job library | Blueprint" description="Site-approved recurring jobs that invited robot teams evaluate in simulation. Blueprint recommends a team whose evaluation passed to the site." canonical="/sites" />
  <section className="ms-container ms-task-page"><a className="ms-back" href="/contact/robot-team">← Robot teams</a>
    <h1>Job library</h1><p>Recurring jobs shared by site owners. Invited robot teams evaluate them free, in a simulation built from the site; Blueprint recommends a team whose evaluation passed, and the site books the pilot.</p><TaskBrowse />
  </section></>; }
