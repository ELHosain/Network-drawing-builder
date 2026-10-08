import React, { useCallback, useEffect, useState } from 'react';
import App from './App.jsx';
import ProfileGate from './components/ProfileGate.jsx';
import {
  loadProfiles, saveProfiles, loadActiveId, saveActiveId, createProfile, purgeProfileData,
  profileKey,
} from './profiles.js';

// The chooser runs before any workspace is open, so useTheme -- which reads a
// per-workspace key -- has not run and nothing has stamped data-theme on the
// document. Without this the chooser fell back to the OS preference and
// rendered light while the editor behind it was dark. It borrows the theme of
// the workspace used last, defaulting to dark, so the two match.
function useGateTheme(active, lastUsedId) {
  useEffect(() => {
    if (active) return;
    let theme = 'dark';
    try {
      const saved = localStorage.getItem(profileKey('netbuilder-theme', lastUsedId));
      if (saved === 'light' || saved === 'dark') theme = saved;
    } catch (e) { /* unreadable preference falls back to dark */ }
    document.documentElement.setAttribute('data-theme', theme);
  }, [active, lastUsedId]);
}

// Owns the list of workspaces, which one is open, and whether the chooser is
// up. Nothing else.
//
// The flow is: open the app -> choose a workspace -> the editor. The chooser is
// shown on every load rather than reopening the last workspace automatically,
// because on a shared machine the person at the keyboard is not necessarily the
// person who used it last, and silently loading someone else's drawing is the
// one outcome worth a click to avoid. The last choice is still remembered, but
// only to mark that card.
//
// App takes the active profile id as its React key, so switching workspaces
// REMOUNTS it. That matters: useProject reads localStorage once in a mount
// effect, so swapping the id on a live component would leave the previous
// person's canvas on screen until something happened to re-read it. A remount
// makes the switch a clean reload of every piece of state -- nodes, wires,
// device library, undo history, zoom -- with no chance of one workspace's data
// leaking into another's.
export default function Root() {
  // One read, shared by both pieces of state. loadProfiles() has a side effect
  // on first run (it creates the initial workspace and adopts any pre-profile
  // work), so it must not be called speculatively.
  const [boot] = useState(() => {
    const list = loadProfiles();
    return { list, lastUsedId: loadActiveId(list) };
  });
  const [profiles, setProfiles] = useState(boot.list);
  const [lastUsedId, setLastUsedId] = useState(boot.lastUsedId);
  const [activeId, setActiveId] = useState(null); // null = the chooser is up

  useGateTheme(activeId !== null, lastUsedId);

  const openProfile = useCallback((id) => {
    setActiveId(id);
    setLastUsedId(id);
    saveActiveId(id);
  }, []);

  // Back to the chooser. The editor unmounts, so its state is gone and the next
  // selection mounts fresh -- the same guarantee as switching between two
  // workspaces.
  const closeProfile = useCallback(() => setActiveId(null), []);

  // These compute from current state and then set it, rather than doing the
  // work inside a functional updater. React calls updaters twice in StrictMode,
  // which would mint two different profile ids for one click and write to
  // storage twice -- updaters have to stay pure.
  const addProfile = useCallback((name, avatar = null) => {
    const p = createProfile(profiles, name, avatar);
    const next = [...profiles, p];
    setProfiles(next);
    saveProfiles(next);
    openProfile(p.id);
  }, [profiles, openProfile]);

  // Takes a patch rather than just a name, so the same path handles a rename, a
  // new photo, or both at once.
  const updateProfile = useCallback((id, patch) => {
    const next = profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setProfiles(next);
    if (!saveProfiles(next)) {
      // Avatars are the only thing here big enough to hit the storage ceiling,
      // and a silent failure would look like the photo simply not sticking.
      // eslint-disable-next-line no-alert
      window.alert('Could not save — this browser\'s storage is full. Try a smaller photo, or remove a workspace you no longer need.');
    }
  }, [profiles]);

  const renameProfile = useCallback((id, name) => updateProfile(id, { name }), [updateProfile]);

  const deleteProfile = useCallback((id) => {
    if (profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    saveProfiles(next);
    purgeProfileData(id);
    if (activeId === id) setActiveId(null);
    if (lastUsedId === id) setLastUsedId(next[0].id);
  }, [profiles, activeId, lastUsedId]);

  if (activeId === null) {
    return (
      <ProfileGate
        profiles={profiles}
        lastUsedId={lastUsedId}
        onSelect={openProfile}
        onCreate={addProfile}
        onUpdate={updateProfile}
        onDelete={deleteProfile}
      />
    );
  }

  return (
    <App
      key={activeId}
      profileId={activeId}
      profiles={profiles}
      onSwitchProfile={openProfile}
      onCreateProfile={addProfile}
      onRenameProfile={renameProfile}
      onDeleteProfile={deleteProfile}
      onBackToProfiles={closeProfile}
    />
  );
}
