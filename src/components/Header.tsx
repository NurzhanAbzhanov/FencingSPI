import { KeyRound, LogIn, LogOut, MessageSquare, ShieldCheck, UserPlus } from "lucide-react";
import type { PlatformUser } from "../types/platform";
import { publicAsset } from "../lib/publicAsset";
import "./Header.css";

export default function Header({ activePage, user, onSignOut, onFeedback, onSidSignup }: { activePage: string; user: PlatformUser | null; onSignOut: () => void; onFeedback: () => void; onSidSignup: () => void }) {
    return <header className="header"><div className="header-content"><a className="header-title" href="#/spi"><img className="usfca-logo" src={publicAsset("/usfca-logo.png")} alt="USFCA" /><span>NCAA Fencing</span></a>
        <nav aria-label="Main navigation"><ul className="nav-list">
            <li><a className={activePage === "spi" ? "active" : ""} href="#/spi">SPI</a></li>
            {user?.role === "admin" && <li><a className={activePage === "enter-results" ? "active" : ""} href="#/enter-results">Enter Results</a></li>}
            <li><a className={["polls", "poll-ballot", "poll-results", "public-poll-results"].includes(activePage) ? "active" : ""} href="#/polls">Coaches Poll</a></li>
            <li><button type="button" className="nav-signup" onClick={onSidSignup}><UserPlus size={16} /> SID Signup</button></li>
            {user?.role === "admin" && <li><a className={["admin", "admin-polls", "admin-coaches", "admin-participation"].includes(activePage) ? "active" : ""} href="#/admin"><ShieldCheck size={15} /> Admin</a></li>}
        </ul></nav>
        <button type="button" className="header-feedback" onClick={onFeedback}><MessageSquare size={17} /><span>Give Feedback</span></button>
        {user && <a href="#/change-password" className="header-account" aria-current={activePage === "change-password" ? "page" : undefined} title="Change password"><KeyRound size={17} /><span>Change password</span></a>}
        {user ? <button className="header-account" onClick={onSignOut} title="Sign out"><span>{user.name}</span><LogOut size={17} /></button> : <a className="header-account" href="#/sign-in"><LogIn size={17} /><span>Login</span></a>}
    </div></header>;
}
