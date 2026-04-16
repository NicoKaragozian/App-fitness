import React, { useState, useEffect, useRef } from 'react';
import { useSportGroups } from '../hooks/useSportGroups';
import type { SportGroupConfig, CreateGroupPayload } from '../hooks/useSportGroups';
import { apiFetch } from '../api/client';

const VALID_METRICS: { key: string; label: string }[] = [
  { key: 'sessions',  label: 'Sessions' },
  { key: 'distance',  label: 'Distance (KM)' },
  { key: 'duration',  label: 'Duration (MIN)' },
  { key: 'calories',  label: 'Calories (KCAL)' },
  { key: 'avg_hr',    label: 'Avg HR (BPM)' },
  { key: 'max_speed', label: 'Max Speed (KM/H)' },
];

const CHART_DATAKEYS: { key: string; label: string }[] = [
  { key: 'distance',  label: 'Distance KM' },
  { key: 'duration',  label: 'Duration MIN' },
  { key: 'calories',  label: 'Calories KCAL' },
  { key: 'avgHr',     label: 'Avg HR BPM' },
  { key: 'maxSpeed',  label: 'Max Speed KM/H' },
];

const PRESET_COLORS = ['#6a9cff', '#f3ffca', '#ff7439', '#22d3a5', '#c084fc', '#fb923c', '#f472b6', '#34d399'];
const PRESET_ICONS = ['◎', '◈', '⚡', '●', '◆', '▲', '★', '◉', '◇', '⬟'];

const SPORT_TYPE_GROUPS: { label: string; types: string[] }[] = [
  {
    label: 'Water',
    types: ['surfing', 'kitesurfing', 'kiteboarding', 'windsurfing', 'stand_up_paddleboarding',
      'sailing', 'kayaking', 'rowing', 'swimming', 'open_water_swimming', 'diving',
      'whitewater_rafting', 'wakeboarding', 'water_skiing'],
  },
  {
    label: 'Running & Walking',
    types: ['running', 'trail_running', 'treadmill_running', 'track_running',
      'walking', 'hiking', 'mountain_hiking'],
  },
  {
    label: 'Cycling',
    types: ['cycling', 'road_cycling', 'mountain_biking', 'gravel_cycling',
      'indoor_cycling', 'virtual_cycling'],
  },
  {
    label: 'Mountain & Snow',
    types: ['mountaineering', 'rock_climbing', 'indoor_climbing', 'skiing', 'snowboarding',
      'backcountry_skiing', 'cross_country_skiing', 'snowshoeing'],
  },
  {
    label: 'Racquet',
    types: ['tennis', 'padel', 'squash', 'badminton', 'table_tennis', 'pickleball'],
  },
  {
    label: 'Gym & Fitness',
    types: ['strength_training', 'gym', 'indoor_cardio', 'yoga', 'pilates',
      'hiit', 'cardio', 'aerobics', 'crossfit', 'boxing', 'martial_arts',
      'dance', 'gymnastics', 'cheerleading'],
  },
  {
    label: 'Others',
    types: ['golf', 'triathlon', 'duathlon', 'obstacle_run', 'soccer', 'basketball',
      'volleyball', 'baseball', 'softball', 'american_football', 'rugby', 'cricket',
      'field_hockey', 'ice_hockey', 'skating', 'roller_skating', 'skateboarding',
      'horse_riding', 'hunting', 'fishing', 'other'],
  },
];

// Todos los sport types de Garmin (derivado de SPORT_TYPE_GROUPS para evitar duplicados)
const ALL_GARMIN_SPORT_TYPES = SPORT_TYPE_GROUPS.flatMap((g) => g.types);


const EMPTY_FORM: CreateGroupPayload = {
  name: '',
  subtitle: '',
  color: '#6a9cff',
  icon: '◎',
  sportTypes: [],
  metrics: ['sessions', 'duration', 'calories'],
  chartMetrics: [{ dataKey: 'duration', name: 'Duration MIN', type: 'bar' }],
};

interface GroupFormProps {
  initial: CreateGroupPayload;
  availableSportTypes: string[];
  existingGroupId?: string;
  onSave: (payload: CreateGroupPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

const GroupForm: React.FC<GroupFormProps> = ({ initial, availableSportTypes, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState<CreateGroupPayload>(initial);

  // Open by default the categories that already have selected types
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const open = new Set<string>();
    SPORT_TYPE_GROUPS.forEach((g) => {
      if (g.types.some((t) => initial.sportTypes.includes(t))) open.add(g.label);
    });
    return open;
  });

  const toggleCategory = (label: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const toggleMetric = (key: string) => {
    setForm((f) => ({
      ...f,
      metrics: f.metrics.includes(key) ? f.metrics.filter((m) => m !== key) : [...f.metrics, key],
    }));
  };

  const toggleSportType = (st: string) => {
    setForm((f) => ({
      ...f,
      sportTypes: f.sportTypes.includes(st) ? f.sportTypes.filter((s) => s !== st) : [...f.sportTypes, st],
    }));
  };

  const setBarMetric = (key: string) => {
    const def = CHART_DATAKEYS.find((d) => d.key === key);
    if (!def) return;
    setForm((f) => ({
      ...f,
      chartMetrics: [
        { dataKey: key, name: def.label, type: 'bar' },
        ...f.chartMetrics.filter((m) => m.type === 'line'),
      ],
    }));
  };

  const setLineMetric = (key: string) => {
    if (key === '') {
      setForm((f) => ({ ...f, chartMetrics: f.chartMetrics.filter((m) => m.type === 'bar') }));
      return;
    }
    const def = CHART_DATAKEYS.find((d) => d.key === key);
    if (!def) return;
    setForm((f) => ({
      ...f,
      chartMetrics: [
        ...f.chartMetrics.filter((m) => m.type === 'bar'),
        { dataKey: key, name: def.label, type: 'line' },
      ],
    }));
  };

  const currentBar = form.chartMetrics.find((m) => m.type === 'bar')?.dataKey ?? '';
  const currentLine = form.chartMetrics.find((m) => m.type === 'line')?.dataKey ?? '';

  return (
    <div className="space-y-5">
      {/* Name + Subtitle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">NAME</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="E.g.: CARDIO MIX"
            className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">SUBTITLE</label>
          <input
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            placeholder="E.g.: TENNIS / RUNNING"
            className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Color + Icon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">COLOR</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">ICON</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                  form.icon === ic ? 'bg-primary text-surface' : 'bg-surface-container text-on-surface hover:bg-surface-container'
                }`}
                style={form.icon === ic ? {} : { color: form.color }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sport Types — grouped by category */}
      <div>
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">
          INCLUDED SPORTS
          {form.sportTypes.length > 0 && (
            <span className="ml-2 normal-case font-normal" style={{ color: form.color }}>
              {form.sportTypes.length} selected
            </span>
          )}
        </label>
        <div className="space-y-1">
          {SPORT_TYPE_GROUPS.map((cat) => {
            // Solo mostrar tipos disponibles para este grupo (no reclamados por otros)
            const visibleTypes = cat.types.filter((t) => availableSportTypes.includes(t) || form.sportTypes.includes(t));
            if (visibleTypes.length === 0) return null;
            const selectedInCat = visibleTypes.filter((t) => form.sportTypes.includes(t)).length;
            const isOpen = openCategories.has(cat.label);
            return (
              <div key={cat.label} className="rounded-lg overflow-hidden border border-outline-variant/20">
                {/* Cabecera del accordion */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.label)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-surface-container hover:bg-surface-container/80 transition-colors"
                >
                  <span className="font-label text-sm text-on-surface">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    {selectedInCat > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-full font-label text-xs font-bold text-surface leading-none"
                        style={{ background: form.color }}
                      >
                        {selectedInCat}
                      </span>
                    )}
                    <span className={`text-on-surface-variant text-xs transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>
                {/* Tipos dentro del accordion */}
                {isOpen && (
                  <div className="px-3 py-2.5 flex flex-wrap gap-2 bg-surface-container/40">
                    {visibleTypes.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggleSportType(st)}
                        className={`px-3 py-1 rounded-full font-label text-xs tracking-wide transition-all ${
                          form.sportTypes.includes(st)
                            ? 'text-surface font-bold'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                        }`}
                        style={form.sportTypes.includes(st) ? { background: form.color } : {}}
                      >
                        {st.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics */}
      <div>
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">METRICS TO DISPLAY</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {VALID_METRICS.map((m) => (
            <label key={m.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.metrics.includes(m.key)}
                onChange={() => toggleMetric(m.key)}
                className="accent-primary"
              />
              <span className="font-label text-sm text-on-surface">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Chart config */}
      <div>
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">CHART</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="font-label text-xs text-on-surface-variant mb-1">Primary metric (bars)</p>
            <select
              value={currentBar}
              onChange={(e) => setBarMetric(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            >
              <option value="">— no chart —</option>
              {CHART_DATAKEYS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="font-label text-xs text-on-surface-variant mb-1">Secondary metric (line)</p>
            <select
              value={currentLine}
              onChange={(e) => setLineMetric(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            >
              <option value="">— none —</option>
              {CHART_DATAKEYS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="font-label text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase"
        >
          CANCEL
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || form.metrics.length === 0}
          className="px-5 py-2 rounded-lg bg-primary text-surface font-label text-label-sm tracking-widest uppercase font-bold disabled:opacity-50"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
      </div>
    </div>
  );
};

interface SportGroupEditorProps {
  onClose: () => void;
}

export const SportGroupEditor: React.FC<SportGroupEditorProps> = ({ onClose }) => {
  const { groups, loading, createGroup, updateGroup, deleteGroup, reorderGroups } = useSportGroups();
  const [availableSportTypes, setAvailableSportTypes] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<SportGroupConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drag-and-drop state
  const dragIndex = useRef<number | null>(null);
  const [localGroups, setLocalGroups] = useState<SportGroupConfig[]>([]);

  useEffect(() => {
    if (!loading) setLocalGroups(groups);
  }, [groups, loading]);

  useEffect(() => {
    apiFetch<string[]>('/activities/sport-types')
      .then(setAvailableSportTypes)
      .catch(() => setAvailableSportTypes([]));
  }, []);

  // Filter out sport types already claimed by other groups (excluding editing group)
  const getAvailableSportTypes = (excludeGroupId?: string) => {
    const claimed = new Set(
      groups
        .filter((g) => g.id !== excludeGroupId)
        .flatMap((g) => g.sportTypes)
    );
    // Combine: full Garmin list + those recorded in DB + those already in groups
    const all = new Set([...ALL_GARMIN_SPORT_TYPES, ...availableSportTypes]);
    groups.forEach((g) => g.sportTypes.forEach((st) => all.add(st)));
    return Array.from(all).sort().filter((st) => !claimed.has(st));
  };

  const handleSaveCreate = async (payload: CreateGroupPayload) => {
    setSaving(true);
    setFormError(null);
    try {
      await createGroup(payload);
      setIsCreating(false);
    } catch (err: any) {
      setFormError(err?.message ?? 'Error creating group');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (payload: CreateGroupPayload) => {
    if (!editingGroup) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateGroup(editingGroup.id, payload);
      setEditingGroup(null);
    } catch (err: any) {
      setFormError(err?.message ?? 'Error saving group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group? Activities will move to "Others".')) return;
    try {
      await deleteGroup(id);
    } catch {}
  };

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    const reordered = [...localGroups];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(i, 0, moved);
    dragIndex.current = i;
    setLocalGroups(reordered);
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
    reorderGroups(localGroups.map((g) => g.id)).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-bright rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">SETTINGS</p>
            <h2 className="font-display font-bold text-on-surface text-xl">SPORT GROUPS</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create / Edit form */}
          {isCreating && (
            <div className="bg-surface-container rounded-xl p-4">
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4">NEW GROUP</p>
              <GroupForm
                initial={{ ...EMPTY_FORM }}
                availableSportTypes={getAvailableSportTypes()}
                onSave={handleSaveCreate}
                onCancel={() => { setIsCreating(false); setFormError(null); }}
                saving={saving}
                error={formError}
              />
            </div>
          )}

          {editingGroup && (
            <div className="bg-surface-container rounded-xl p-4">
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4">EDIT GROUP</p>
              <GroupForm
                initial={{
                  name: editingGroup.name,
                  subtitle: editingGroup.subtitle,
                  color: editingGroup.color,
                  icon: editingGroup.icon,
                  sportTypes: editingGroup.sportTypes,
                  metrics: editingGroup.metrics,
                  chartMetrics: editingGroup.chartMetrics,
                }}
                availableSportTypes={getAvailableSportTypes(editingGroup.id)}
                existingGroupId={editingGroup.id}
                onSave={handleSaveEdit}
                onCancel={() => { setEditingGroup(null); setFormError(null); }}
                saving={saving}
                error={formError}
              />
            </div>
          )}

          {/* Group list */}
          {!isCreating && !editingGroup && (
            <>
              {loading ? (
                <p className="text-on-surface-variant font-label text-sm">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {localGroups.map((g, i) => (
                    <div
                      key={g.id}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing"
                    >
                      <span className="text-on-surface-variant/40 text-xs select-none">⠿</span>
                      <span style={{ color: g.color }}>{g.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-on-surface text-sm leading-none">{g.name}</p>
                        <p className="font-label text-xs text-on-surface-variant mt-0.5 truncate">{g.sportTypes.join(', ')}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingGroup(g); setFormError(null); }}
                          className="px-3 py-1 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface font-label text-xs tracking-widest uppercase transition-colors"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="px-3 py-1 rounded-lg bg-surface-container text-on-surface-variant hover:text-red-400 font-label text-xs tracking-widest uppercase transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setIsCreating(true); setFormError(null); }}
                className="w-full py-4 rounded-xl bg-primary/10 border border-primary/40 hover:bg-primary/20 hover:border-primary/70 text-primary font-label font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span>
                ADD GROUP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
