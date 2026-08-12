import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import type { PlatformUser } from "../types/platform";
import "./Header.css";

export default function Header({ activePage, user, onSignOut }: { activePage: string; user: PlatformUser | null; onSignOut: () => void }) {
    return <header className="header"><div className="header-content"><a className="header-title" href="#/spi"><img className="usfca-logo" src="/usfca-logo.png" alt="USFCA" /><span>NCAA Fencing</span></a>
        <nav aria-label="Main navigation"><ul className="nav-list">
            <li><a className={activePage === "spi" ? "active" : ""} href="#/spi">SPI</a></li>
            {user?.role === "admin" && <li><a className={activePage === "enter-results" ? "active" : ""} href="#/enter-results">Enter Results</a></li>}
            <li><a className={["polls", "ballot", "transparency"].includes(activePage) ? "active" : ""} href="#/polls">Coaches Poll</a></li>
            {user?.role === "admin" && <li><a className={activePage === "admin" ? "active" : ""} href="#/admin"><ShieldCheck size={15} /> Admin</a></li>}
        </ul></nav>
        {user ? <button className="header-account" onClick={onSignOut} title="Sign out"><span>{user.name}</span><LogOut size={17} /></button> : <a className="header-account" href="#/sign-in"><LogIn size={17} /><span>Login</span></a>}
    </div></header>;
}
