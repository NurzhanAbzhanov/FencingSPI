import { supabase } from './supabase';
import { prepareCalendarHtml } from './calendarImport';
import renderer from './calendarRenderer.txt?raw';

export type CalendarVersion = { id: string; filename: string; created_at: string };
export type CalendarDocument = CalendarVersion & { html: string; published_at?: string };

export function readCalendarFile(file: File): Promise<string> {
    if (!/\.html?$/i.test(file.name)) return Promise.reject(new Error('Select an .html or .htm file.'));
    if (!file.size || file.size > 1048576) return Promise.reject(new Error('Upload a nonempty HTML file no larger than 1 MiB.'));
    return new Promise((resolve,reject) => {
        const reader=new FileReader();
        reader.onerror=()=>reject(new Error('Could not read this file.'));
        reader.onload=()=>{
            const html=String(reader.result ?? '');
            if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html) || html.includes('\0')) {
                reject(new Error('Upload a standalone HTML document with html and body tags.'));
            } else {
                try {prepareCalendarHtml(html);resolve(html);} catch(error){reject(error);}
            }
        };
        reader.readAsText(file,'utf-8');
    });
}

export function buildCalendarDocument(html: string): string {
    const {markup,events,months}=prepareCalendarHtml(html);
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const policy=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
    const data=JSON.stringify(events).replace(/</g,'\\u003c');
    const trusted=`const E=${data};const MONTHS=${JSON.stringify(months)};const now=new Date();const TODAY=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');\n${renderer}`;
    const bridge=`<script>(()=>{let last=0;const send=()=>{const height=Math.ceil(document.documentElement.scrollHeight);if(height!==last){last=height;parent.postMessage({type:'calendar-height',height},'*');}};new ResizeObserver(send).observe(document.body);addEventListener('load',send);send();})();</script>`;
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}">\n${markup}\n<style>input[type="checkbox"]{min-width:0}.controls label{display:inline-flex;align-items:center;gap:6px}.grid{grid-template-columns:repeat(7,minmax(0,1fr))}.day{min-width:0}.controls input[type="search"]{min-width:0;max-width:100%}</style><script nonce="${nonce}">${trusted}</script>${bridge.replace('<script>',`<script nonce="${nonce}">`)}`;
}

export async function loadPublishedCalendar(): Promise<CalendarDocument | null> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const {data,error}=await supabase.rpc('get_published_calendar');
    if (error) throw new Error(error.message);
    return (data?.[0] as CalendarDocument | undefined) ?? null;
}

export async function listCalendarVersions(): Promise<CalendarVersion[]> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const {data,error}=await supabase.from('calendar_versions').select('id,filename,created_at').order('created_at',{ascending:false}).order('id');
    if (error) throw new Error(error.message);
    return data as CalendarVersion[];
}

export async function loadCalendarVersion(id: string): Promise<CalendarDocument> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const {data,error}=await supabase.from('calendar_versions').select('id,filename,created_at,html').eq('id',id).single();
    if (error) throw new Error(error.message);
    return data as CalendarDocument;
}

export async function saveCalendarVersion(filename: string, html: string): Promise<string> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const {data,error}=await supabase.rpc('save_calendar_version',{p_filename:filename,p_html:html});
    if (error) throw new Error(error.message);
    return data as string;
}

export async function publishCalendarVersion(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const {error}=await supabase.rpc('publish_calendar_version',{p_version_id:id});
    if (error) throw new Error(error.message);
}
