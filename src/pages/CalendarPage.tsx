import { useEffect, useState } from 'react';
import CalendarFrame from '../components/CalendarFrame';
import { loadPublishedCalendar } from '../lib/calendarRepository';
import type { CalendarDocument } from '../lib/calendarRepository';
import './Calendar.css';

export default function CalendarPage() {
    const [document,setDocument]=useState<CalendarDocument | null>(null);
    const [status,setStatus]=useState('loading');
    const [attempt,setAttempt]=useState(0);
    useEffect(()=>{
        let active=true;
        loadPublishedCalendar().then(value=>{if(active){setDocument(value);setStatus('ready');}})
            .catch(()=>{if(active) setStatus('error');});
        return ()=>{active=false;};
    },[attempt]);
    if(status==='loading') return <p role="status" className="page-loading">Loading calendar</p>;
    if(status==='error') return <section className="empty-state"><h1>Calendar unavailable</h1><button className="button secondary" onClick={()=>{setStatus('loading');setAttempt(value=>value+1);}}>Retry</button></section>;
    if(!document) return <section className="empty-state"><h1>Calendar</h1><p>No calendar has been published yet.</p></section>;
    return <section className="calendar-page" aria-label="Competition calendar"><CalendarFrame key={document.id} html={document.html} /></section>;
}
