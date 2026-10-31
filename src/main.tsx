import React from 'react';
import ReactDOM from 'react-dom/client';
const SampleApp=React.lazy(()=>import('./ui/App'));
const LiveApp=React.lazy(()=>import('./live/LiveApp'));
import './ui/styles.css';
import './live/entry.css';

function setMode(mode:'preview'|'live'){
  const url=new URL(window.location.href);
  url.searchParams.set('mode',mode);
  window.location.assign(url.toString());
}
function Entry(){
  const mode=new URLSearchParams(window.location.search).get('mode');
  // Local development starts on the real API workspace.
  // Static Pages remains an explicitly labeled sample UI until API/Kernel deployment.
  const live=mode==='live'||(mode!=='preview'&&
    (import.meta.env.DEV || import.meta.env.VITE_NUTRITION_LIVE_DEFAULT==='true'));
  if(live)return <React.Suspense fallback={<div role="status">Opening authenticated workspace…</div>}><LiveApp onPreview={()=>setMode('preview')}/></React.Suspense>;
  return <><React.Suspense fallback={<div role="status">Opening sample preview…</div>}><SampleApp/></React.Suspense><button className="lv-preview-switch" type="button"
    onClick={()=>setMode('live')} title="Open authenticated API-connected workspace">
    <span>◉</span> Backend workspace <span aria-hidden="true">↗</span>
  </button></>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Entry/></React.StrictMode>,
);
