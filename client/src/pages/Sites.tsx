import { SEO } from "@/components/SEO";
import { TaskBrowse } from "@/components/site/TaskBrowse";
export default function Sites() { return <>
  <SEO title="Job library | Blueprint" description="Site-approved recurring jobs shared for compatible technology assessment and delivery planning." canonical="/sites" />
  <section className="ms-container ms-task-page"><a className="ms-back" href="/partners">← For partners</a>
    <h1>Job library</h1><p>Recurring jobs shared by site owners for approved partners. Job details, access and next steps depend on site permission and compatibility. A listing is not an awarded contract or a claim of deployment readiness.</p><TaskBrowse />
  </section></>; }
