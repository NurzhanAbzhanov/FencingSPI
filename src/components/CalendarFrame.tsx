import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCalendarDocument } from '../lib/calendarRepository';

export default function CalendarFrame({html}: {html:string}) {
    const ref=useRef<HTMLIFrameElement>(null);
    const [height,setHeight]=useState(800);
    const document=useMemo(()=>{
        try {return {source:buildCalendarDocument(html),error:''};}
        catch(error){return {source:'',error:error instanceof Error ? error.message : 'Unsupported calendar format.'};}
    },[html]);
    useEffect(()=>{
        function resize(event: MessageEvent) {
            if (event.source!==ref.current?.contentWindow || event.origin!=='null' || event.data?.type!=='calendar-height') return;
            const next=event.data.height;
            if (typeof next==='number' && Number.isFinite(next) && next>=400 && next<=30000) setHeight(Math.ceil(next));
        }
        window.addEventListener('message',resize);
        return ()=>window.removeEventListener('message',resize);
    },[]);
    if(document.error) return <p role="alert">{document.error}</p>;
    return <iframe ref={ref} className="calendar-frame" title="Fencing calendar" sandbox="allow-scripts"
        referrerPolicy="no-referrer" srcDoc={document.source} style={{height:`${height}px`}} />;
}
