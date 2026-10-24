import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TeamLogo from './TeamLogo';

afterEach(() => { delete window.NCAA_FENCING_ASSET_BASE; });

describe('TeamLogo', () => {
    it.each(['Brandeis University', 'Drew University', 'Haverford College', 'Hunter College'])('loads %s from the WordPress plugin', (name) => {
        window.NCAA_FENCING_ASSET_BASE = 'https://usfca.org/wp-content/plugins/ncaa-fencing/app';
        render(<TeamLogo name={name} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('/wp-content/plugins/ncaa-fencing/app/school-logos/'));
    });

    it('retries a different school after an image failure', () => {
        const { rerender } = render(<TeamLogo name="Brandeis University" />);
        fireEvent.error(screen.getByRole('img'));
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        rerender(<TeamLogo name="Drew University" />);
        expect(screen.getByRole('img')).toHaveAttribute('src', '/school-logos/drew.webp');
    });
});
