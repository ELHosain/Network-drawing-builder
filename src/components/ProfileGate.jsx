import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { initials, profileStats, formatBytes, profileBytes } from '../profiles.js';
import GateCard from './GateCard.jsx';
import AddProfileDialog from './AddProfileDialog.jsx';

// Lazy so the WebGL library stays out of the startup bundle. The CSS aurora
// below renders immediately and the rays fade in over it once loaded, so there
// is nothing to see pop in.
const LightRays = lazy(() => import('./LightRays.jsx'));

// How long the launch runs before the editor takes over. The flight lands just
// before the handover, so the editor appears to come out of it.
//
// A reduced-motion preference SHORTENS this rather than removing the sequence.
// Skipping it outright meant anyone with "animation effects" turned off in
// Windows got no transition at all -- the selection simply cut to the editor --
// and this animation was asked for specifically. Less motion, not none.
const LAUNCH_MS = 700;
const LAUNCH_MS_REDUCED = 400;

function AvatarFace({ profile }) {
  return profile.avatar
    ? <img src={profile.avatar} alt="" draggable={false} />
    : <>{initials(profile.name)}</>;
}

function Avatar({ profile, innerRef }) {
  return (
    <span
      className="gate-avatar"
      ref={innerRef}
      style={profile.avatar ? undefined : { '--face': profile.color }}
    >
      <AvatarFace profile={profile} />
    </span>
  );
}

// The screen shown before the editor. Deliberately not a social-media picker:
// each card leads with what the workspace CONTAINS, because four engineers
// sharing a machine tell their workspaces apart by the drawing in them.
//
// A plain <div> for the masthead, not <header>: the editor's global `header`
// rule paints a full-width glass bar with the brand gradient along its bottom,
// and the element selector was catching this one too.
export default function ProfileGate({
  profiles, lastUsedId, onSelect, onCreate, onUpdate, onDelete,
}) {
  // null = closed, 'new' = creating, otherwise the profile being edited.
  const [editor, setEditor] = useState(null);
  // One pointer position shared by every card, so a pointer move costs a single
  // motion-value write rather than a React render of the whole row.
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // The launch in progress: which profile, and where its avatar sat on screen
  // when it was clicked. Null until a card is chosen.
  const [launch, setLaunch] = useState(null);
  const avatarRefs = useRef(new Map());
  const timerRef = useRef(0);

  const stats = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, { ...profileStats(p.id), bytes: profileBytes(p.id) }])),
    [profiles],
  );

  // Snapshots the avatar's position on screen, then flies a copy of it from
  // exactly there to the centre. Measuring at click time rather than assuming a
  // position is what puts the copy precisely on top of the original for the
  // first frame, so it reads as that avatar lifting off its card rather than a
  // second one appearing from nowhere.
  const choose = useCallback((id) => {
    if (launch) return;
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    const el = avatarRefs.current.get(id);
    setLaunch({ id, profile, rect: el ? el.getBoundingClientRect() : null });
    timerRef.current = setTimeout(() => onSelect(id), reduced ? LAUNCH_MS_REDUCED : LAUNCH_MS);
  }, [launch, profiles, onSelect, reduced]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    const onKey = (e) => {
      if (editor || launch) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= Math.min(9, profiles.length)) choose(profiles[n - 1].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profiles, editor, launch, choose]);

  const launchSeconds = (reduced ? LAUNCH_MS_REDUCED : LAUNCH_MS) / 1000;

  // Where the flying avatar ends up: dead centre, grown past the viewport, so
  // it reads as the workspace opening out rather than an icon drifting away.
  const flightTarget = () => {
    const end = Math.max(window.innerWidth, window.innerHeight) * 1.25;
    return {
      width: end,
      height: end,
      fontSize: end * 0.26,
      top: window.innerHeight / 2 - end / 2,
      left: window.innerWidth / 2 - end / 2,
    };
  };

  return (
    <div className={`gate${launch ? ' launching' : ''}`} style={{ '--launch': `${launchSeconds}s` }}>
      <div className="gate-glow" aria-hidden="true" />
      <Suspense fallback={null}>
        <LightRays
          raysOrigin="top-center"
          raysColor="#009999"
          raysColor2="#641e8c"
          raysSpeed={0.7}
          lightSpread={1.1}
          rayLength={1.9}
          followMouse
          mouseInfluence={0.12}
          noiseAmount={0.03}
          distortion={0.05}
          saturation={0.95}
        />
      </Suspense>

      <div className="gate-inner">
        <div className="gate-head">
          <span className="gate-logo-wrap" aria-hidden="true">
            <span className="gate-logo-ring" />
            <span className="gate-logo-glow" />
            <img className="gate-logo" src="/logo-96.png" alt="" width="96" height="96" draggable={false} />
          </span>
          <h1 className="gate-brand">Network Drawing Builder</h1>
          <p className="gate-sub">Industrial topology editor</p>
        </div>

        <h2 className="gate-title">Choose your workspace</h2>
        <p className="gate-note">
          Each workspace keeps its own drawings, device library and settings on this computer.
        </p>

        <ul
          className="gate-grid"
          onMouseMove={(e) => { if (!launch) mouseX.set(e.clientX); }}
          onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        >
          {profiles.map((p, i) => {
            const s = stats[p.id] || { devices: 0, links: 0, custom: 0, bytes: 0 };
            const empty = s.devices === 0 && s.links === 0;
            const chosen = launch?.id === p.id;
            return (
              <li key={p.id} style={{ '--i': i }} className={launch && !chosen ? 'dimmed' : ''}>
                <GateCard
                  mouseX={mouseX}
                  reduced={reduced}
                  className={chosen ? 'chosen' : ''}
                  onClick={() => choose(p.id)}
                  disabled={launch !== null}
                >
                  <span className="gate-sheen" aria-hidden="true" />
                  {i < 9 && <span className="gate-key">{i + 1}</span>}
                  {p.id === lastUsedId && <span className="gate-last">Last used</span>}

                  <Avatar
                    profile={p}
                    innerRef={(el) => {
                      if (el) avatarRefs.current.set(p.id, el);
                      else avatarRefs.current.delete(p.id);
                    }}
                  />

                  <span className="gate-name">{p.name}</span>

                  {empty ? (
                    <span className="gate-stats empty">Empty canvas</span>
                  ) : (
                    <span className="gate-stats">
                      <span><b>{s.devices}</b> device{s.devices !== 1 ? 's' : ''}</span>
                      <i />
                      <span><b>{s.links}</b> link{s.links !== 1 ? 's' : ''}</span>
                    </span>
                  )}

                  <span className="gate-meta">
                    {s.custom > 0 ? `${s.custom} custom device${s.custom !== 1 ? 's' : ''} · ` : ''}
                    {formatBytes(s.bytes)}
                  </span>
                </GateCard>

                {/* Shares the top-right corner with the "Last used" badge and
                    fades in over it, so the two can never collide the way the
                    old bottom-centred placement did with the meta line. */}
                <span className="gate-actions">
                  <button
                    title="Edit name and photo"
                    onClick={() => setEditor(p)}
                  >
                    &#9998;
                  </button>
                  <button
                    className="danger"
                    disabled={profiles.length <= 1}
                    title={profiles.length <= 1
                      ? 'You cannot delete your only workspace'
                      : `Delete "${p.name}" and everything in it`}
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      if (window.confirm(`Delete "${p.name}" and everything saved in it?\n\nThis cannot be undone.`)) {
                        onDelete(p.id);
                      }
                    }}
                  >
                    &times;
                  </button>
                </span>
              </li>
            );
          })}

          <li style={{ '--i': profiles.length }} className={launch ? 'dimmed' : ''}>
            <GateCard
              mouseX={mouseX}
              reduced={reduced}
              className="add"
              onClick={() => setEditor('new')}
              disabled={launch !== null}
            >
              <span className="gate-avatar add-mark">+</span>
              <span className="gate-name">Add workspace</span>
              <span className="gate-meta">A fresh canvas and library</span>
            </GateCard>
          </li>
        </ul>

        <p className="gate-foot">
          Stored in this browser on this PC — not an account. Use <b>Save</b> inside the
          editor to keep a backup file of anything important.
        </p>
      </div>

      {/* The flight sits OUTSIDE .gate-inner on purpose: that element recedes
          and blurs during a launch, and the avatar has to stay sharp while it
          travels. Width and height are animated rather than a scale, for the
          same reason the cards are -- a scaled bitmap would soften the face or
          the initials exactly when they are largest. */}
      <AnimatePresence>
        {launch && launch.rect && (
          <motion.div
            key="flight"
            className="gate-flight"
            aria-hidden="true"
            style={{ '--face': launch.profile.color }}
            initial={{
              top: launch.rect.top,
              left: launch.rect.left,
              width: launch.rect.width,
              height: launch.rect.height,
              fontSize: Math.max(16, launch.rect.width * 0.32),
              opacity: 1,
            }}
            animate={{ ...flightTarget(), opacity: 0 }}
            transition={{
              duration: launchSeconds,
              ease: [0.55, 0, 0.25, 1],
              opacity: {
                delay: launchSeconds * 0.45,
                duration: launchSeconds * 0.55,
              },
            }}
          >
            <AvatarFace profile={launch.profile} />
          </motion.div>
        )}
      </AnimatePresence>

      <AddProfileDialog
        open={editor !== null}
        profile={editor === 'new' ? null : editor}
        onCancel={() => setEditor(null)}
        onSubmit={(name, avatar) => {
          const target = editor;
          setEditor(null);
          if (target === 'new') onCreate(name, avatar);
          else onUpdate(target.id, { name, avatar });
        }}
      />
    </div>
  );
}
