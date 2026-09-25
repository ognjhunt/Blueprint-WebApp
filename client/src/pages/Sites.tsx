import { SEO } from "@/components/SEO";
import { TaskBrowse } from "@/components/site/TaskBrowse";
export default function Sites() { return <>
  <SEO title="Task library | Blueprint" description="Site-approved recurring tasks for robot teams to assess against their capabilities and possible physical pilots." canonical="/sites" />
  <section className="ms-container ms-task-page"><a className="ms-back" href="/contact/robot-team">← Robot teams</a>
    <h1>Task library</h1><p>Recurring tasks shared by site owners. Approved robot teams can assess fit and discuss a scoped physical pilot where capability, budget, and timing align.</p><TaskBrowse />
  </section></>; }
