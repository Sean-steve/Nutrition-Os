import React from 'react';
import ReactDOM from 'react-dom/client';
import SampleApp from './ui/App';
import LiveApp from './live/LiveApp';
import './ui/styles.css';

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
  if(live)return <LiveApp onPreview={()=>setMode('preview')}/>;
  return <><SampleApp/><button className="lv-preview-switch" type="button"
    onClick={()=>setMode('live')} title="Open authenticated API-connected workspace">
    <span>◉</span> Backend workspace <span aria-hidden="true">↗</span>
  </button></>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Entry/></React.StrictMode>,
);
