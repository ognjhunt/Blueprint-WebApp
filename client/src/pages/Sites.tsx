import { SEO } from "@/components/SEO";
import { TaskBrowse } from "@/components/site/TaskBrowse";
export default function Sites() { return <>
  <SEO title="Task library | Blueprint" description="Browse live and past tasks shared by site owners." canonical="/sites" />
  <section className="ms-container ms-task-page"><a className="ms-back" href="/contact/robot-team">← Robot teams</a>
    <h1>Task library</h1><p>Live opportunities, tasks in capture, and past work to evaluate against.</p><TaskBrowse />
  </section></>; }
