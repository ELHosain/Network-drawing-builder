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
const LEGACY_KEYS = [
  'netbuilder-react-save',
  'netbuilder-react-custom-devices',
  'netbuilder-react-hidden-builtins',
  'netbuilder-theme',
];

export const PROFILE_COLORS = ['#1f9d55', '#2b7fd4', '#b5760f', '#8e44c4', '#c2485a', '#148f8f'];

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

export function createProfile(list, name) {
  const id = `p${Date.now().toString(36)}`;
  return {
    id,
    name: name.trim() || 'Untitled',
    color: PROFILE_COLORS[list.length % PROFILE_COLORS.length],
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
