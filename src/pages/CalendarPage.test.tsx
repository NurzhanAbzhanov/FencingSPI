import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../lib/calendarRepository',async importOriginal=>({...await importOriginal<typeof import('../lib/calendarRepository')>(),loadPublishedCalendar:load}));
import CalendarPage from './CalendarPage';
import { calendarFixture } from '../test/calendarFixture';
describe('CalendarPage',()=>{
    it('renders only published HTML in the sandbox',async()=>{
        load.mockResolvedValueOnce({id:'published',html:calendarFixture});
        render(<CalendarPage />);
        expect(await screen.findByTitle('Fencing calendar')).toHaveAttribute('sandbox','allow-scripts');
    });
    it('reports an unavailable calendar instead of inventing content',async()=>{
        load.mockRejectedValueOnce(new Error('Network unavailable'));
        render(<CalendarPage />);
        expect(await screen.findByRole('heading',{name:'Calendar unavailable'})).toBeInTheDocument();
    });
});
