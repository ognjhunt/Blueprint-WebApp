import { useEffect, useState } from "react";

/** No stock site photos: a missing or withdrawn photo becomes an explicitly labeled diagram. */
export function TaskThumbnail({ src, title, taskFamily }: { src?: string | null; title: string; taskFamily: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const pallet = /pallet|stack/i.test(`${title} ${taskFamily}`);
  const inspect = /inspect|scan/i.test(`${title} ${taskFamily}`);
  return <figure className="ms-task-thumbnail">
    {src && !failed ? <img src={src} alt={`Owner-approved task view: ${title}`} width={480} height={300} loading="lazy" onError={() => setFailed(true)} /> :
      <svg viewBox="0 0 240 150" role="img" aria-label={`Illustration of ${taskFamily || "a task"}, not a site photo`}>
        <rect width="240" height="150" fill="#e9eade" />
        <g fill="none" stroke="#526255" strokeWidth="2" strokeLinejoin="round">
          <path d="M18 115H222M35 95V115M96 95V115M32 95H100" />
          <path d="M38 87H94L105 96H28Z" fill="#cbd1c3" />
          <path d="M42 87V63L68 51L91 64V87M42 63L65 76L91 64M65 76V91" fill="#d6dbc9" />
          <path d="M111 63H150M143 57L151 63L143 69" />
          {pallet ? <><path d="M158 108H213M161 101V112M209 101V112" /><path d="M166 100V78H205V100M166 78L180 70H219L205 78M205 78L219 70V91L205 100M183 78V100" fill="#cbd1c3" /><path d="M177 69V49H207V69M177 49L187 43H217L207 49M207 49L217 43V61L207 69" fill="#d6dbc9" /></> :
          inspect ? <><path d="M172 99H212V76H172ZM187 31V55M174 32H203V46H174Z" fill="#cbd1c3" /><path d="M181 54L168 70M197 54L211 70" strokeDasharray="3 3" /></> :
          <><path d="M159 75L196 62L221 77L185 93ZM159 75V103L185 117L221 101V77M185 93V117" fill="#cbd1c3" /><path d="M174 68V52L192 45L207 54V69M174 52L190 61L207 54M190 61V77" fill="#d6dbc9" /></>}
        </g>
      </svg>}
    <figcaption>{src && !failed ? "Owner-approved task photo" : "Task illustration · not a site photo"}</figcaption>
  </figure>;
}
