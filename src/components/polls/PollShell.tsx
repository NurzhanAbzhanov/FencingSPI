import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PollShell({ title, eyebrow = 'USFCA Coaches Poll', backHref, actions, children }: {
    title: string;
    eyebrow?: string;
    backHref?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return <section className="page-section poll-page">
        {backHref && <a className="back-link" href={backHref}><ArrowLeft size={16} /> Coaches Poll</a>}
        <div className="poll-page-heading">
            <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
            {actions && <div className="poll-heading-actions">{actions}</div>}
        </div>
        {children}
    </section>;
}
