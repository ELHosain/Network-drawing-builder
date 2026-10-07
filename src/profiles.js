// Per-person workspaces.
//
// The app has no backend: everything lives in this browser's localStorage. A
// workspace is therefore just a namespace in that store, and a "profile" is a
// name attached to one. Four people get four completely separate canvases,
// device libraries and preferences, with no server, no accounts and no way for
// one person's work to touch another's.
//
// What this deliberately does NOT do is authenticate anybody. Profiles are a
// convenience so colleagues sharing a machine stop overwriting each other --
// not a security boundary. Anyone at the keyboard can switch to any profile,
// and that is the honest description to give the team.

const INDEX_KEY = 'netbuilder-profiles';
const ACTIVE_KEY = 'netbuilder-active-profile';

// The keys the app used before profiles existed. Whatever is sitting in them
// belongs to whoever has been using this browser, so it is adopted by the
// first profile rather than being stranded.
export const SAVE_BASE = 'netbuilder-react-save';
export const CUSTOM_BASE = 'netbuilder-react-custom-devices';

const LEGACY_KEYS = [
  SAVE_BASE,
  CUSTOM_BASE,
  'netbuilder-react-hidden-builtins',
  'netbuilder-theme',
];

// Fallback avatar colours, drawn around the Siemens Energy petrol/violet pair
// so a profile without a photo still looks like part of the product.
export const PROFILE_COLORS = ['#009999', '#641e8c', '#00737d', '#8b4db0', '#0f7a8a', '#4e1670'];

// Every per-profile key is suffixed, so adding a new stored value later needs
// no extra bookkeeping -- route it through here and it is namespaced for free.
export function profileKey(base, profileId) {
  return profileId ? `${base}::${profileId}` : base;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadProfiles() {
  const list = read(INDEX_KEY, null);
  if (Array.isArray(list) && list.length) return list;

  // First run. Create one profile and hand it any pre-existing work.
  const first = {
    id: 'p1',
    name: 'Me',
    color: PROFILE_COLORS[0],
    createdAt: Date.now(),
  };
  adoptLegacyData(first.id);
  write(INDEX_KEY, [first]);
  return [first];
}

// Copies the old un-namespaced values into the first profile's namespace. The
// originals are left untouched: if this version is ever rolled back, the
// previous build still finds the work exactly where it left it.
function adoptLegacyData(profileId) {
  LEGACY_KEYS.forEach((base) => {
    try {
      const raw = localStorage.getItem(base);
      if (raw !== null && localStorage.getItem(profileKey(base, profileId)) === null) {
        localStorage.setItem(profileKey(base, profileId), raw);
      }
    } catch (e) { /* quota or unavailable -- nothing to migrate */ }
  });
}

export function saveProfiles(list) {
  return write(INDEX_KEY, list);
}

export function loadActiveId(list) {
  const id = read(ACTIVE_KEY, null);
  return list.some((p) => p.id === id) ? id : list[0]?.id;
}

export function saveActiveId(id) {
  write(ACTIVE_KEY, id);
}

export function createProfile(list, name, avatar = null) {
  // The id is the storage namespace for the whole workspace, so a collision
  // would silently point two profiles at one set of drawings -- the exact
  // failure this separation exists to prevent. A timestamp alone is not enough:
  // two profiles created within the same millisecond produced identical ids.
  // Random entropy plus an explicit check against the ids already in use.
  const taken = new Set(list.map((p) => p.id));
  let id;
  do {
    id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (taken.has(id));

  return {
    id,
    name: name.trim() || 'Untitled',
    color: PROFILE_COLORS[list.length % PROFILE_COLORS.length],
    avatar,
    createdAt: Date.now(),
  };
}

// Deleting a profile has to take its stored data with it, or the workspace
// lingers invisibly and keeps eating the browser's storage quota.
export function purgeProfileData(profileId) {
  LEGACY_KEYS.forEach((base) => {
    try { localStorage.removeItem(profileKey(base, profileId)); } catch (e) { /* ignore */ }
  });
}

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Rough size of one profile's stored data, for the "storage used" readout.
// localStorage is a per-origin budget of around 5MB shared by every profile,
// and custom device photos are base64 data URLs, so four people with their own
// device libraries can genuinely run it out. Showing the number is cheaper
// than explaining a silent save failure later.
export function profileBytes(profileId) {
  let total = 0;
  LEGACY_KEYS.forEach((base) => {
    try {
      const raw = localStorage.getItem(profileKey(base, profileId));
      if (raw) total += raw.length + base.length;
    } catch (e) { /* ignore */ }
  });
  return total;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// What a profile has in it, read straight from its stored workspace. The
// selection screen shows this so a returning user can tell their workspaces
// apart by content rather than by name alone -- which matters when four
// colleagues share a machine and the names are all first names.
export function profileStats(profileId) {
  const stats = { devices: 0, links: 0, custom: 0 };
  try {
    const raw = localStorage.getItem(profileKey(SAVE_BASE, profileId));
    if (raw) {
      const data = JSON.parse(raw);
      stats.devices = Array.isArray(data.nodes) ? data.nodes.length : 0;
      stats.links = Array.isArray(data.wires) ? data.wires.length : 0;
    }
  } catch (e) { /* unreadable workspace reports as empty */ }
  try {
    const raw = localStorage.getItem(profileKey(CUSTOM_BASE, profileId));
    if (raw) stats.custom = Object.keys(JSON.parse(raw) || {}).length;
  } catch (e) { /* ignore */ }
  return stats;
}

// Avatars live in the profile index alongside the name, so the selection screen
// can paint every card without touching each workspace's own storage.
export function setProfileAvatar(list, id, avatar) {
  return list.map((p) => (p.id === id ? { ...p, avatar } : p));
}
