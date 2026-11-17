import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CalendarFrame from './CalendarFrame';
import { calendarFixture } from '../test/calendarFixture';

describe('CalendarFrame', () => {
    it('isolates scripts from the app and rejects resize messages from unrelated windows', () => {
        render(<CalendarFrame html={calendarFixture} />);
        const frame=screen.getByTitle('Fencing calendar') as HTMLIFrameElement;
        expect(frame).toHaveAttribute('sandbox','allow-scripts');
        expect(frame).toHaveAttribute('referrerpolicy','no-referrer');
        fireEvent(window,new MessageEvent('message',{source:window,data:{type:'calendar-height',height:5000}}));
        expect(frame.style.height).toBe('800px');
        fireEvent(window,new MessageEvent('message',{source:frame.contentWindow,origin:'null',data:{type:'calendar-height',height:2400}}));
        expect(frame.style.height).toBe('2400px');
    });
});
