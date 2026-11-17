import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: null }));
import { buildCalendarDocument, readCalendarFile } from './calendarRepository';
import { calendarFixture } from '../test/calendarFixture';

describe('calendar documents', () => {
    const html=calendarFixture;
    it('accepts a standalone HTML upload without changing its source', async () => {
        expect(await readCalendarFile(new File([html],'calendar.html'))).toBe(html);
    });
    it('rejects wrong file types, oversized files and incomplete documents', async () => {
        await expect(readCalendarFile(new File([html],'calendar.txt'))).rejects.toThrow('.html');
        await expect(readCalendarFile(new File(['x'.repeat(1048577)],'calendar.html'))).rejects.toThrow('1 MiB');
        await expect(readCalendarFile(new File(['<p>Not a document</p>'],'calendar.html'))).rejects.toThrow('standalone');
    });
    it('prepends restrictive policy before untrusted content while retaining inline interaction', () => {
        const document=buildCalendarDocument(html);
        expect(document.indexOf('Content-Security-Policy')).toBeLessThan(document.indexOf('const E='));
        expect(document).toContain("connect-src 'none'");
        expect(document).toContain("frame-src 'none'");
        expect(document).toContain("form-action 'none'");
        expect(document).toContain("script-src 'nonce-");
        expect(document).not.toContain('allow-same-origin');
    });
    it('never executes uploaded navigation code, event handlers or meta refresh',()=>{
        const source=html.replace('<body>','<body onload="location=\'https://attacker.test\'"><meta http-equiv="refresh" content="0;url=https://attacker.test">')
            .replace('const E=',"location='https://attacker.test';const E=");
        const output=buildCalendarDocument(source);
        expect(output).not.toContain('attacker.test');
        expect(output).not.toContain('onload=');
        expect(output).not.toContain('http-equiv="refresh"');
    });
    it('rejects executable event fields and escapes HTML inside meet names',()=>{
        expect(()=>buildCalendarDocument(html.replace('"Meet"','location.href'))).toThrow('literal text');
        const output=buildCalendarDocument(html.replace('"Meet"','"<img src=x onerror=location=1>"'));
        expect(output).toContain('\\u003cimg');
        expect(output).not.toContain('<img');
    });
    it('requires unique, correctly typed renderer elements and bounds expanded output',()=>{
        expect(()=>buildCalendarDocument(html.replace('id="q"','id="missing"'))).toThrow('input#q');
        expect(()=>buildCalendarDocument(html.replace('</body>','<input id="q"></body>'))).toThrow('Duplicate');
        expect(()=>buildCalendarDocument(html.replace('"Meet"',JSON.stringify('x'.repeat(1001))))).toThrow('1,000 characters');
        const large=html.replace('"Meet"',JSON.stringify('x'.repeat(1000))).replace('"2026-11-18","2026-11-18"','"2026-01-01","2027-12-31"');
        expect(()=>buildCalendarDocument(large)).toThrow('too large');
    });
});
