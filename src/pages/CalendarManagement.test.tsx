import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({list:vi.fn(),published:vi.fn(),load:vi.fn(),save:vi.fn(),publish:vi.fn()}));
vi.mock('../lib/calendarRepository',async importOriginal=>({
    ...await importOriginal<typeof import('../lib/calendarRepository')>(),
    listCalendarVersions:mocks.list,loadPublishedCalendar:mocks.published,loadCalendarVersion:mocks.load,
    saveCalendarVersion:mocks.save,publishCalendarVersion:mocks.publish,
}));
import CalendarManagement from './CalendarManagement';
import { calendarFixture } from '../test/calendarFixture';
const first={id:'one',filename:'first.html',created_at:'2026-11-17T10:00:00Z',html:calendarFixture};
describe('CalendarManagement',()=>{
    beforeEach(()=>{
        mocks.list.mockReset().mockResolvedValue([first]);mocks.published.mockReset().mockResolvedValue(first);
        mocks.load.mockReset().mockResolvedValue(first);mocks.save.mockReset().mockResolvedValue('two');
        mocks.publish.mockReset().mockResolvedValue(undefined);vi.spyOn(window,'confirm').mockReturnValue(true);
    });
    it('previews an upload, saves privately, then publishes only after an explicit action',async()=>{
        render(<CalendarManagement />);
        await screen.findByText(/Published: first.html/);
        const html=calendarFixture;
        await userEvent.upload(screen.getByLabelText('Updated calendar HTML'),new File([html],'second.html'));
        await waitFor(()=>expect(screen.getByRole('button',{name:'Save draft'})).toBeEnabled());
        expect(mocks.publish).not.toHaveBeenCalled();
        mocks.list.mockResolvedValue([{...first,id:'two',filename:'second.html'},first]);
        await userEvent.click(screen.getByRole('button',{name:'Save draft'}));
        await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith('second.html',html));
        expect(mocks.publish).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button',{name:'Publish selected version'}));
        await waitFor(()=>expect(mocks.publish).toHaveBeenCalledWith('two'));
    });
    it('restores an earlier version and reports a failed publish without replacing the preview',async()=>{
        mocks.published.mockResolvedValue({...first,id:'two',filename:'second.html'});
        render(<CalendarManagement />);
        await screen.findByText(/Published: second.html/);
        await userEvent.selectOptions(screen.getByLabelText('Saved versions'),'one');
        await waitFor(()=>expect(screen.getByRole('button',{name:'Publish selected version'})).toBeEnabled());
        mocks.publish.mockRejectedValueOnce(new Error('Publication failed'));
        await userEvent.click(screen.getByRole('button',{name:'Publish selected version'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('Publication failed');
        expect(screen.getByText(/Published: second.html/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button',{name:'Publish selected version'}));
        await waitFor(()=>expect(mocks.publish).toHaveBeenCalledTimes(2));
        expect(mocks.publish).toHaveBeenLastCalledWith('one');
    });
});
