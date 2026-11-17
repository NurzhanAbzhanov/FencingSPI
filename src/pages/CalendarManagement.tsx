import { Globe, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import CalendarFrame from '../components/CalendarFrame';
import { listCalendarVersions,loadCalendarVersion,loadPublishedCalendar,publishCalendarVersion,readCalendarFile,saveCalendarVersion } from '../lib/calendarRepository';
import type { CalendarDocument,CalendarVersion } from '../lib/calendarRepository';
import './Calendar.css';

export default function CalendarManagement() {
    const [versions,setVersions]=useState<CalendarVersion[]>([]);
    const [published,setPublished]=useState<CalendarDocument | null>(null);
    const [preview,setPreview]=useState<CalendarDocument | null>(null);
    const [selected,setSelected]=useState('');
    const [upload,setUpload]=useState<{filename:string;html:string} | null>(null);
    const [busy,setBusy]=useState(true);
    const [message,setMessage]=useState('');
    const [error,setError]=useState('');
    const [inputKey,setInputKey]=useState(0);
    const [attempt,setAttempt]=useState(0);
    useEffect(()=>{
        let active=true;
        Promise.all([listCalendarVersions(),loadPublishedCalendar()]).then(([history,current])=>{
            if(!active) return;
            setVersions(history);setPublished(current);setSelected(current?.id ?? '');setPreview(current);setUpload(null);setInputKey(value=>value+1);
        }).catch(cause=>{if(active) setError(errorText(cause));})
            .finally(()=>{if(active) setBusy(false);});
        return ()=>{active=false;};
    },[attempt]);

    async function readUpload(file?:File) {
        if(!file) return;
        setBusy(true);setError('');setMessage('');setUpload(null);
        try {
            const html=await readCalendarFile(file);
            setUpload({filename:file.name,html});setSelected('');
            setPreview({id:'local',filename:file.name,html,created_at:new Date().toISOString()});
        } catch(cause) {setError(errorText(cause));}
        finally {setBusy(false);}
    }

    async function chooseVersion(id:string) {
        setSelected(id);setUpload(null);setInputKey(value=>value+1);setMessage('');setError('');
        if(!id){setPreview(null);return;}
        setBusy(true);
        try {setPreview(await loadCalendarVersion(id));}
        catch(cause){setSelected('');setPreview(null);setError(errorText(cause));}
        finally {setBusy(false);}
    }

    async function save() {
        if(!upload) return;
        setBusy(true);setError('');setMessage('');
        try {
            const id=await saveCalendarVersion(upload.filename,upload.html);
            setPreview({id,...upload,created_at:new Date().toISOString()});setSelected(id);
            setUpload(null);setInputKey(value=>value+1);
            setVersions(await listCalendarVersions());
            setMessage('Draft saved. The public calendar is unchanged.');
        } catch(cause){setError(errorText(cause));}
        finally {setBusy(false);}
    }

    async function publish() {
        if(!selected || upload || !window.confirm('Publish this calendar version for all visitors? You can restore an earlier version afterward.')) return;
        setBusy(true);setError('');setMessage('');
        try {
            await publishCalendarVersion(selected);
            setPublished(await loadPublishedCalendar());setMessage('Calendar published.');
        } catch(cause){setError(errorText(cause));}
        finally {setBusy(false);}
    }

    return <section className="admin-section" aria-labelledby="calendar-admin-title">
        <h2 id="calendar-admin-title">Calendar</h2>
        <p className="calendar-published">HTML from the supplied calendar format · 1 MiB maximum · Event data and styling only</p>
        <p className="calendar-published">{published ? `Published: ${published.filename}${published.published_at ? ` · ${new Date(published.published_at).toLocaleString()}` : ''}` : 'No published calendar'}</p>
        <div className="calendar-admin-controls">
            <label>Updated calendar HTML<input key={inputKey} type="file" accept=".html,.htm" disabled={busy} onChange={event=>void readUpload(event.target.files?.[0])} /></label>
            <button className="button secondary" type="button" disabled={busy || !upload} onClick={save}><Save size={17} /> Save draft</button>
        </div>
        <div className="calendar-admin-controls">
            <label>Saved versions<select disabled={busy} value={selected} onChange={event=>void chooseVersion(event.target.value)}>
                <option value="">{upload ? 'Unsaved preview' : 'Select version'}</option>
                {versions.map(version=><option key={version.id} value={version.id}>{version.filename} · {new Date(version.created_at).toLocaleString()}{version.id===published?.id ? ' · Published' : ''}</option>)}
            </select></label>
            <button className="button primary" type="button" disabled={busy || !selected || Boolean(upload) || selected===published?.id} onClick={publish}><Globe size={17} /> Publish selected version</button>
            <a className="icon-text-link" href="#/calendar">View public calendar</a>
        </div>
        {busy && <p role="status">Loading calendar</p>}
        {error && <div role="alert" className="form-message error">{error} <button type="button" className="button secondary" disabled={busy} onClick={()=>{setBusy(true);setError('');setAttempt(value=>value+1);}}>Reload versions</button></div>}
        {message && <p role="status" className="form-message">{message}</p>}
        {preview && <details className="calendar-preview" open><summary>{preview.filename}{upload ? ' · Unsaved preview' : ' · Preview'}</summary><CalendarFrame key={preview.id+preview.html} html={preview.html} /></details>}
    </section>;
}
function errorText(error:unknown):string {return error instanceof Error ? error.message : 'Calendar could not be updated.';}
