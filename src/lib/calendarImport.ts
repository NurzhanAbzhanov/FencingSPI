import { parse as parseHtml, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { parse as parseScript } from 'acorn';

type HtmlNode=DefaultTreeAdapterMap['node'];
const tags=new Set(['html','head','body','title','style','link','header','h1','h2','h3','p','div','span','input','select','option','label','button','section','dialog','ul','ol','li','b','small','strong','br']);
const attributes=new Set(['id','class','style','type','placeholder','value','checked','hidden','for','lang','rel','href']);

export function prepareCalendarHtml(source:string):{markup:string;events:string[][];months:number[][]} {
    const document=parseHtml(source);
    const scripts:string[]=[];
    function clean(node:HtmlNode) {
        if(!('childNodes' in node)) return;
        node.childNodes=node.childNodes.filter(child=>{
            if(!('tagName' in child)) return child.nodeName==='#text';
            if(child.tagName==='script') {
                scripts.push(child.childNodes.filter(n=>n.nodeName==='#text').map(n=>(n as DefaultTreeAdapterMap['textNode']).value).join(''));
                return false;
            }
            if(!tags.has(child.tagName)) return false;
            child.attrs=child.attrs.filter(attr=>attributes.has(attr.name) && (attr.name!=='href' || child.tagName==='link' && /^https:\/\/fonts\.googleapis\.com\//.test(attr.value)));
            if(child.tagName==='button') child.attrs=child.attrs.filter(attr=>attr.name!=='type').concat([{name:'type',value:'button'}]);
            clean(child);
            return true;
        });
    }
    clean(document);
    const ids=new Map<string,DefaultTreeAdapterMap['element']>();
    function collect(node:HtmlNode) {
        if('tagName' in node) {
            const id=node.attrs.find(attr=>attr.name==='id')?.value;
            if(id){if(ids.has(id)) throw new Error(`Duplicate calendar element: ${id}`);ids.set(id,node);}
        }
        if('childNodes' in node) node.childNodes.forEach(collect);
    }
    collect(document);
    const required={stats:'div',q:'input',type:'select',gender:'select',hidePast:'input',tCal:'button',tList:'button',cal:'div',list:'div',dlg:'dialog',dlgBody:'div'};
    for(const [id,tag] of Object.entries(required)) {
        if(ids.get(id)?.tagName!==tag) throw new Error(`Calendar layout requires ${tag}#${id}. Use the supplied HTML format.`);
    }
    if(ids.get('hidePast')?.attrs.find(attr=>attr.name==='type')?.value!=='checkbox') throw new Error('Calendar hidePast must be a checkbox.');
    function containsButton(node:HtmlNode):boolean {return 'tagName' in node && node.tagName==='button' || 'childNodes' in node && node.childNodes.some(containsButton);}
    if(!containsButton(ids.get('dlg')!)) throw new Error('Calendar dialog requires a Close button.');
    let events:string[][] | undefined;
    for(const script of scripts) {
        const ast=parseScript(script,{ecmaVersion:'latest'});
        for(const statement of ast.body) {
            if(statement.type!=='VariableDeclaration') continue;
            for(const declaration of statement.declarations) {
                if(declaration.id.type!=='Identifier' || declaration.id.name!=='E') continue;
                if(events || declaration.init?.type!=='ArrayExpression') throw new Error('Calendar event data must be one literal E array.');
                events=declaration.init.elements.map(row=>{
                    if(row?.type!=='ArrayExpression' || row.elements.length!==9) throw new Error('Each calendar event must contain nine text fields.');
                    return row.elements.map(value=>{
                        if(value?.type!=='Literal' || typeof value.value!=='string') throw new Error('Calendar events may contain only literal text, not executable code.');
                        return value.value;
                    });
                });
            }
        }
    }
    if(!events?.length || events.length>1000) throw new Error('Use the supplied calendar HTML format with 1–1,000 events in const E.');
    let expandedSize=0;
    for(const row of events) {
        const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
        if(!validDate(row[0]) || !validDate(row[1]) || row[0]>row[1] || !['inv','dual','conf','champ','nat'].includes(row[5]) || !['M','W','MW'].includes(row[6])) throw new Error('Calendar contains an invalid date, meet type, or gender.');
        if(row.some(value=>value.length>1000)) throw new Error('Calendar text fields must not exceed 1,000 characters.');
        const days=(Date.parse(row[1])-Date.parse(row[0]))/86400000+1;
        expandedSize+=days*(12*row[2].length+6*row[3].length+300)+row.join('').length*6+500;
        if(expandedSize>4194304) throw new Error('Calendar is too large to render safely. Shorten multi-day events or text fields.');
    }
    const start=events.reduce((a,row)=>row[0]<a ? row[0] : a,events[0][0]);
    const end=events.reduce((a,row)=>row[1]>a ? row[1] : a,events[0][1]);
    const first=Number(start.slice(0,4))*12+Number(start.slice(5,7))-1;
    const last=Number(end.slice(0,4))*12+Number(end.slice(5,7))-1;
    if(last-first>23) throw new Error('Calendar must span no more than 24 months.');
    const months=Array.from({length:last-first+1},(_,i)=>[Math.floor((first+i)/12),(first+i)%12]);
    return {markup:serialize(document),events,months};
}
