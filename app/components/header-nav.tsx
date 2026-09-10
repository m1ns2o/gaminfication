"use client";
import "../studio.css";

import { useState } from "react";
import { LogIn, LogOut, Menu, Plus, X } from "lucide-react";
import type { StudioAuth, View } from "../lib/studio-types";

export function HeaderNav({
  view,
  onView,
  onCreate,
  onJoin,
  auth,
}: {
  view: View;
  onView: (view: View) => void;
  onCreate: () => void;
  onJoin: () => void;
  auth: StudioAuth;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="nav-slab">
      <button className="slab-mark" type="button" onClick={() => onView("dashboard")}>
        <span className="slab-mark__glyph" aria-hidden="true">B</span>
        <span>BOARDRUN</span>
      </button>
      <nav className="slab-nav" aria-label="주요 메뉴">
        <button type="button" aria-current={view === "dashboard" ? "page" : undefined} onClick={() => onView("dashboard")}>내 게임</button>
        <button type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => onView("library")}>공유마당</button>
        <button type="button" onClick={onJoin}>코드로 참가</button>
      </nav>
      <div className="nav-actions">
        <button className="button button--quiet nav-create" type="button" onClick={onCreate}>
          <Plus aria-hidden="true" />
          새 게임
        </button>
        {auth.user ? (
          <form action={auth.signOutPath} method="post">
            <input type="hidden" name="returnTo" value="/" />
            <button className="profile-button" type="submit" title={`${auth.user.displayName} · 로그아웃`}>
              <span className="profile-button__avatar" aria-hidden="true">{auth.user.displayName.trim().charAt(0) || "교"}</span>
              <span className="profile-button__name">{auth.user.displayName}</span>
              <LogOut aria-hidden="true" />
            </button>
          </form>
        ) : (
          <a className="auth-button" href={auth.signInPath}><LogIn aria-hidden="true" /> 교사용 로그인</a>
        )}
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen && (
        <nav id="mobile-navigation" className="mobile-navigation" aria-label="모바일 메뉴">
          <button type="button" onClick={() => { onView("dashboard"); setMobileOpen(false); }}>내 게임</button>
          <button type="button" onClick={() => { onView("library"); setMobileOpen(false); }}>공유마당</button>
          <button type="button" onClick={() => { onJoin(); setMobileOpen(false); }}>코드로 참가</button>
          <button type="button" onClick={() => { onCreate(); setMobileOpen(false); }}>새 게임</button>
          {auth.user ? (
            <form action={auth.signOutPath} method="post"><input type="hidden" name="returnTo" value="/" /><button type="submit">로그아웃</button></form>
          ) : <a href={auth.signInPath}>교사용 로그인</a>}
        </nav>
      )}
    </header>
  );
}
