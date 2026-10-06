import React, { useCallback, useState } from 'react';
import App from './App.jsx';
import {
  loadProfiles, saveProfiles, loadActiveId, saveActiveId, createProfile, purgeProfileData,
} from './profiles.js';

// Owns the list of workspaces and which one is open, and nothing else.
//
// The App below is given the active profile id as its React key, so switching
// workspaces REMOUNTS it. That matters: useProject reads localStorage once in a
// mount effect, so swapping the id on a live component would leave the previous
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
    return { list, activeId: loadActiveId(list) };
  });
  const [profiles, setProfiles] = useState(boot.list);
  const [activeId, setActiveId] = useState(boot.activeId);

  const switchProfile = useCallback((id) => {
    setActiveId(id);
    saveActiveId(id);
  }, []);

  // These compute from the current state and then set it, rather than doing the
  // work inside a functional updater. React calls updaters twice in StrictMode,
  // which would mint two different profile ids for one click and write to
  // storage twice -- updaters have to stay pure.
  const addProfile = useCallback((name) => {
    const p = createProfile(profiles, name);
    const next = [...profiles, p];
    setProfiles(next);
    saveProfiles(next);
    setActiveId(p.id);
    saveActiveId(p.id);
  }, [profiles]);

  const renameProfile = useCallback((id, name) => {
    const next = profiles.map((p) => (p.id === id ? { ...p, name } : p));
    setProfiles(next);
    saveProfiles(next);
  }, [profiles]);

  const deleteProfile = useCallback((id) => {
    if (profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    saveProfiles(next);
    purgeProfileData(id);
    if (activeId === id) {
      setActiveId(next[0].id);
      saveActiveId(next[0].id);
    }
  }, [profiles, activeId]);

  return (
    <App
      key={activeId}
      profileId={activeId}
      profiles={profiles}
      onSwitchProfile={switchProfile}
      onCreateProfile={addProfile}
      onRenameProfile={renameProfile}
      onDeleteProfile={deleteProfile}
    />
  );
}
