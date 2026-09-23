import { SEO } from "@/components/SEO";
import { TaskBrowse } from "@/components/site/TaskBrowse";
export default function Sites() { return <>
  <SEO title="Task library | Blueprint" description="Real site tasks shared by site owners, open to robot teams in early access." canonical="/sites" />
  <section className="ms-container ms-task-page"><a className="ms-back" href="/contact/robot-team">← Robot teams</a>
    <h1>Task library</h1><p>Real site tasks, shared by the sites that run them, that approved robot teams can evaluate against.</p><TaskBrowse />
  </section></>; }
