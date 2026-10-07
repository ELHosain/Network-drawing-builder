import React, { memo, useRef, useState, useMemo } from 'react';
import { processDeviceImage } from '../utils/imageTools.js';
import { useMagnify } from '../useMagnify.js';

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="9" r="6" />
      <path d="M17 17l-4-4" />
    </svg>
  );
}

function Palette({
  presets, builtinKeys, customKeys, hiddenBuiltinKeys, onStartDrag,
  onAddCustomDevice, onRemoveCustomDevice, onHideBuiltin, onRestoreBuiltins, toast,
}) {
  const fileInputRef = useRef(null);
  // Vertical: the palette is a column, so distance is measured on Y. The list
  // scrolls, so this must not affect layout -- a transform does not.
  const { containerRef, magnifyProps } = useMagnify({ axis: 'y', max: 1.24, distance: 125 });
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (key) => !q || (presets[key]?.name || '').toLowerCase().includes(q);
  const visibleCustom = useMemo(() => customKeys.filter(matches), [customKeys, q, presets]);
  const visibleBuiltin = useMemo(() => builtinKeys.filter(matches), [builtinKeys, q, presets]);
  const hasAnyResults = visibleCustom.length > 0 || visibleBuiltin.length > 0;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image file'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const processed = await processDeviceImage(reader.result, 220);
        // eslint-disable-next-line no-alert
        const name = window.prompt('Name for this device:', file.name.replace(/\.[^.]+$/, '')) || 'custom_device';
        onAddCustomDevice(processed, name);
        toast('Device added — background removed, image resized');
      } catch (err) {
        toast('Could not process that image');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="palette" ref={containerRef} {...magnifyProps}>
      <div className="search-box">
        <SearchIcon />
        <input
          placeholder="Search devices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!hasAnyResults && q && <div className="no-results">No devices match "{query}"</div>}

      {(visibleCustom.length > 0 || !q) && <h2>My devices</h2>}
      <div id="customList">
        {visibleCustom.map((key) => (
          <div
            key={key}
            className="pitem" data-magnify
            onPointerDown={(e) => { if (!e.target.closest('.rm')) onStartDrag(key, presets[key]?.name, e); }}
          >
            <button
              type="button"
              className="rm"
              title="remove from library"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemoveCustomDevice(key); toast('Removed from library'); }}
            >
              &times;
            </button>
            <img src={presets[key].img} alt={presets[key].name} draggable={false} />
            <span>{presets[key].name}</span>
          </div>
        ))}
      </div>
      {!q && (
        <div className="pitem" data-magnify id="addCustom" onClick={() => fileInputRef.current?.click()}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>+</div>
          <span>Add photo</span>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {(visibleBuiltin.length > 0 || !q) && (
        <h2>
          Library
          {hiddenBuiltinKeys.length > 0 && (
            <button
              className="ghost restore-link"
              onClick={() => { onRestoreBuiltins(); toast('Library restored'); }}
              title="Bring back removed library devices"
            >
              restore ({hiddenBuiltinKeys.length})
            </button>
          )}
        </h2>
      )}
      {visibleBuiltin.map((key) => (
        <div
          key={key}
          className="pitem" data-magnify
          onPointerDown={(e) => { if (!e.target.closest('.rm')) onStartDrag(key, presets[key]?.name, e); }}
        >
          <button
            type="button"
            className="rm"
            title="remove from library"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHideBuiltin(key); toast('Removed from library'); }}
          >
            &times;
          </button>
          <img src={presets[key].img} alt={presets[key].name} draggable={false} />
          <span>{presets[key].name}</span>
        </div>
      ))}
      {!q && (
        <div
          className="pitem" data-magnify
          onPointerDown={(e) => onStartDrag('generic', 'device', e)}
        >
          <div className="placeholder-img" style={{ width: 42, height: 34 }} />
          <span>blank box</span>
        </div>
      )}
    </div>
  );
}

export default memo(Palette);
