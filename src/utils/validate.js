// Design-rule checks for a network drawing.
//
// The drawing already holds everything needed to catch the mistakes that
// actually cost time on site -- two devices sharing an address, a node that was
// placed but never wired, an address that cannot reach the rest of the network.
// None of those are visible by looking at the picture, which is exactly why
// they survive a review and get discovered during commissioning.
//
// Every rule returns plain data: a severity, a message, and the ids it concerns,
// so the UI can list them and jump to the device without knowing anything about
// the rules themselves.

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIp(value) {
  const m = IPV4.exec(String(value || '').trim());
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts;
}

// Treated as a /24, which is what essentially every machine-level Profinet
// network uses. Anything else is unusual enough that a warning the engineer can
// read and dismiss is more useful than silence.
function subnetOf(parts) {
  return parts.slice(0, 3).join('.');
}

const label = (node) => node.name || node.model || node.ip || 'Unnamed device';

export function validateProject(nodes, wires, title) {
  const issues = [];
  // The index keeps the id unique even for rules that carry no node ids -- the
  // title-block checks all would have collapsed to the same key otherwise, and
  // React silently renders only one of a set of duplicate keys.
  const add = (severity, rule, message, nodeIds = []) => {
    issues.push({ id: `${rule}:${nodeIds.join(',')}:${issues.length}`, severity, rule, message, nodeIds });
  };

  // ---- addressing -------------------------------------------------------
  const byIp = new Map();
  nodes.forEach((n) => {
    const raw = String(n.ip || '').trim();
    if (!raw) {
      add('warning', 'no-ip', `${label(n)} has no IP address`, [n.id]);
      return;
    }
    const parsed = parseIp(raw);
    if (!parsed) {
      add('error', 'bad-ip', `${label(n)} has an invalid IP address ("${raw}")`, [n.id]);
      return;
    }
    if (!byIp.has(raw)) byIp.set(raw, []);
    byIp.get(raw).push(n);
  });

  // The one that matters most. Two nodes answering on the same address is the
  // classic Profinet bring-up failure and is completely invisible on the canvas.
  byIp.forEach((group, ip) => {
    if (group.length > 1) {
      add(
        'error',
        'duplicate-ip',
        `${group.length} devices share the IP ${ip}: ${group.map(label).join(', ')}`,
        group.map((n) => n.id),
      );
    }
  });

  // Subnet outliers, measured against whichever subnet the majority of devices
  // are on rather than against a hardcoded range.
  const subnetCount = new Map();
  nodes.forEach((n) => {
    const parsed = parseIp(n.ip);
    if (!parsed) return;
    const s = subnetOf(parsed);
    subnetCount.set(s, (subnetCount.get(s) || 0) + 1);
  });
  if (subnetCount.size > 1) {
    const [majority] = [...subnetCount.entries()].sort((a, b) => b[1] - a[1])[0];
    nodes.forEach((n) => {
      const parsed = parseIp(n.ip);
      if (!parsed) return;
      if (subnetOf(parsed) !== majority) {
        add(
          'warning',
          'subnet',
          `${label(n)} (${n.ip}) is on a different subnet from the rest (${majority}.x) — it will need a router to be reachable`,
          [n.id],
        );
      }
    });
  }

  // ---- topology ---------------------------------------------------------
  const wired = new Set();
  wires.forEach((w) => { wired.add(w.fromId); wired.add(w.toId); });
  nodes.forEach((n) => {
    if (!wired.has(n.id)) {
      add('warning', 'orphan', `${label(n)} is not connected to anything`, [n.id]);
    }
  });

  // A link whose two ends are the same device is almost always a misclick, and
  // on a managed switch it is a broadcast loop waiting to happen.
  wires.forEach((w) => {
    if (w.fromId === w.toId) {
      const n = nodes.find((x) => x.id === w.fromId);
      add('error', 'self-link', `${n ? label(n) : 'A device'} is wired to itself`, [w.fromId]);
    }
  });

  // ---- naming -----------------------------------------------------------
  const byName = new Map();
  nodes.forEach((n) => {
    const name = String(n.name || '').trim().toLowerCase();
    if (!name) {
      add('warning', 'no-name', 'A device has no name', [n.id]);
      return;
    }
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(n);
  });
  byName.forEach((group, name) => {
    if (group.length > 1) {
      add('warning', 'duplicate-name', `${group.length} devices are both named "${group[0].name || name}"`, group.map((n) => n.id));
    }
  });

  // ---- title block ------------------------------------------------------
  if (title) {
    if (!String(title.project || '').trim()) add('info', 'title', 'No project name — you will be asked for it when you save', []);
    if (!String(title.machine || '').trim()) add('info', 'title', 'No machine name — you will be asked for it when you save', []);
    if (!String(title.title || '').trim()) add('info', 'title', 'No drawing title — you will be asked for it when you save', []);
    if (!String(title.by || '').trim()) add('info', 'title', 'The drawing has no author', []);
  }

  const counts = { error: 0, warning: 0, info: 0 };
  issues.forEach((i) => { counts[i.severity] += 1; });
  return { issues, counts };
}
