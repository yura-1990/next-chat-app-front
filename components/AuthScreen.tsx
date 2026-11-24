"use client";

import { type FormEvent, useState } from "react";

type Props = {
	busy: boolean;
	error: string | null;
	onRegister: (username: string, password: string) => void;
	onLogin: (username: string, password: string) => void;
};

export function AuthScreen({ busy, error, onRegister, onLogin }: Props) {
	const [mode, setMode] = useState<"login" | "register">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!username.trim() || !password) return;
		if (mode === "login") onLogin(username.trim(), password);
		else onRegister(username.trim(), password);
	}

	return (
		<main className="auth-screen">
			<div className="auth-card">
				<h1 className="auth-heading">morrow.</h1>
				<p className="auth-subheading">
					{mode === "login"
						? "Sign in to your conversations"
						: "Create an account to start chatting"}
				</p>
				<form onSubmit={submit}>
					<div className="auth-field">
						<label htmlFor="auth-username">Username</label>
						<input
							id="auth-username"
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							autoComplete="username"
							disabled={busy}
						/>
					</div>
					<div className="auth-field">
						<label htmlFor="auth-password">Password</label>
						<input
							id="auth-password"
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoComplete={
								mode === "login" ? "current-password" : "new-password"
							}
							disabled={busy}
						/>
					</div>
					{error ? <p className="auth-error">{error}</p> : null}
					<button type="submit" className="auth-submit" disabled={busy}>
						{busy
							? "Please wait…"
							: mode === "login"
								? "Sign in"
								: "Create account"}
					</button>
				</form>
				<p className="auth-switch">
					{mode === "login" ? "New here?" : "Already have an account?"}{" "}
					<button
						type="button"
						onClick={() => setMode(mode === "login" ? "register" : "login")}
					>
						{mode === "login" ? "Create an account" : "Sign in"}
					</button>
				</p>
			</div>
		</main>
	);
}
