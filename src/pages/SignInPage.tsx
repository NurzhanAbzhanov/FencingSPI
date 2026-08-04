import { LogIn, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { PlatformUser } from "../types/platform";
import { signInDemo } from "../lib/platformData";

export default function SignInPage({ onSignedIn }: { onSignedIn: (user: PlatformUser) => void }) {
    const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
    async function signIn(event: React.FormEvent) {
        event.preventDefault();
        if (!supabase) return;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setMessage(error.message);
        const profile = await supabase.from("profiles").select("display_name, role, can_vote").eq("id", data.user.id).single();
        if (profile.error) return setMessage(profile.error.message);
        onSignedIn({ id: data.user.id, name: profile.data.display_name, role: profile.data.role, canVote: profile.data.can_vote });
    }
    return <section className="auth-page"><div className="auth-panel"><p className="eyebrow">Coaches poll committee</p><h1>Sign in</h1>
        {isSupabaseConfigured ? <form onSubmit={signIn} className="stack-form"><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button primary"><LogIn size={17} /> Sign in</button>{message && <p className="form-message error">{message}</p>}</form> : <div className="demo-login"><p>Supabase is not configured in this deployment. Use a local demo role to review the full committee workflow.</p><button className="button primary" onClick={() => onSignedIn(signInDemo("coach"))}><UserRound size={17} /> Continue as coach</button><button className="button secondary" onClick={() => onSignedIn(signInDemo("admin"))}><ShieldCheck size={17} /> Continue as admin</button></div>}
    </div></section>;
}
