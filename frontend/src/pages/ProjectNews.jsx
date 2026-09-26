import { Radio, ArrowUpRight } from 'lucide-react';
import { Modal } from '../components/Primitives';
import { projectUpdates } from '../lib/projectUpdates';

export default function ProjectNews({navigate}){
 return <Modal title="News Feed" subtitle="AGENT.WS / PROJECT UPDATES" id="project-news" wide onClose={()=>navigate('/')}>
  <div className="release-feed-heading"><Radio size={18}/><span data-testid="news-feed-label">Release notes</span><b data-testid="news-current-version">v{projectUpdates[0].version}</b></div>
  <div className="release-feed">{projectUpdates.map((release,i)=><article key={release.version} data-testid={'news-release-'+i}>
   <header><span data-testid={'news-version-'+i}>v{release.version}</span><time data-testid={'news-date-'+i} dateTime={release.date}>{new Date(release.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'})}</time></header>
   <h3 data-testid={'news-title-'+i}>{release.title}</h3>
   <ul>{release.highlights.map(([label,detail],n)=><li key={label} data-testid={'news-highlight-'+i+'-'+n}><b>{label}</b><p>{detail}</p></li>)}</ul>
  </article>)}</div>
 </Modal>;
}