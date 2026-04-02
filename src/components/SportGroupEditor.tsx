import React, { useState, useEffect, useRef } from 'react';
import { useSportGroups } from '../hooks/useSportGroups';
import type { SportGroupConfig, CreateGroupPayload } from '../hooks/useSportGroups';
import { apiFetch } from '../api/client';
import type { ChartMetricConfig } from '../hooks/useActivities';

const VALID_METRICS: { key: string; label: string }[] = [
  { key: 'sessions',  label: 'Sesiones' },
  { key: 'distance',  label: 'Distancia (KM)' },
  { key: 'duration',  label: 'Duración (MIN)' },
  { key: 'calories',  label: 'Calorías (KCAL)' },
  { key: 'avg_hr',    label: 'FC Promedio (BPM)' },
  { key: 'max_speed', label: 'Vel. Máx (KM/H)' },
];

const CHART_DATAKEYS: { key: string; label: string }[] = [
  { key: 'distance',  label: 'Distancia KM' },
  { key: 'duration',  label: 'Duración MIN' },
  { key: 'calories',  label: 'Calorías KCAL' },
  { key: 'avgHr',     label: 'FC Prom BPM' },
  { key: 'maxSpeed',  label: 'Vel. Máx KM/H' },
];

const PRESET_COLORS = ['#6a9cff', '#f3ffca', '#ff7439', '#22d3a5', '#c084fc', '#fb923c', '#f472b6', '#34d399'];
const PRESET_ICONS = ['◎', '◈', '⚡', '●', '◆', '▲', '★', '◉', '◇', '⬟'];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '') || 'group';
}

const EMPTY_FORM: CreateGroupPayload = {
  name: '',
  subtitle: '',
  color: '#6a9cff',
  icon: '◎',
  sportTypes: [],
  metrics: ['sessions', 'duration', 'calories'],
  chartMetrics: [{ dataKey: 'duration', name: 'Duración MIN', type: 'bar' }],
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

const GroupForm: React.FC<GroupFormProps> = ({ initial, availableSportTypes, existingGroupId, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState<CreateGroupPayload>(initial);

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
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">NOMBRE</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: CARDIO MIX"
            className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">SUBTÍTULO</label>
          <input
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            placeholder="Ej: TENIS / RUNNING"
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
          <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">ÍCONO</label>
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

      {/* Sport Types */}
      <div>
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">
          DEPORTES INCLUIDOS
          {availableSportTypes.length === 0 && <span className="ml-2 text-on-surface-variant/50 normal-case">(sin actividades registradas)</span>}
        </label>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {availableSportTypes.map((st) => (
            <button
              key={st}
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
      </div>

      {/* Metrics */}
      <div>
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">MÉTRICAS A MOSTRAR</label>
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
        <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">GRÁFICO</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="font-label text-xs text-on-surface-variant mb-1">Métrica principal (barras)</p>
            <select
              value={currentBar}
              onChange={(e) => setBarMetric(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            >
              <option value="">— sin gráfico —</option>
              {CHART_DATAKEYS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="font-label text-xs text-on-surface-variant mb-1">Métrica secundaria (línea)</p>
            <select
              value={currentLine}
              onChange={(e) => setLineMetric(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 font-label text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            >
              <option value="">— ninguna —</option>
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
          CANCELAR
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || form.metrics.length === 0}
          className="px-5 py-2 rounded-lg bg-primary text-surface font-label text-label-sm tracking-widest uppercase font-bold disabled:opacity-50"
        >
          {saving ? 'GUARDANDO...' : 'GUARDAR'}
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
    // Include all known types plus any recorded but unclaimed types
    const all = new Set([...availableSportTypes]);
    groups.forEach((g) => g.sportTypes.forEach((st) => all.add(st)));
    return Array.from(all).filter((st) => !claimed.has(st));
  };

  const handleSaveCreate = async (payload: CreateGroupPayload) => {
    setSaving(true);
    setFormError(null);
    try {
      await createGroup(payload);
      setIsCreating(false);
    } catch (err: any) {
      setFormError(err?.message ?? 'Error al crear el grupo');
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
      setFormError(err?.message ?? 'Error al guardar el grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este grupo? Las actividades pasarán a "Otros".')) return;
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
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">CONFIGURACIÓN</p>
            <h2 className="font-display font-bold text-on-surface text-xl">GRUPOS DE DEPORTES</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create / Edit form */}
          {isCreating && (
            <div className="bg-surface-container rounded-xl p-4">
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4">NUEVO GRUPO</p>
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
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4">EDITAR GRUPO</p>
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
                <p className="text-on-surface-variant font-label text-sm">Cargando...</p>
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
                          EDITAR
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
                className="w-full py-3 rounded-xl border border-dashed border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/70 font-label text-label-sm tracking-widest uppercase transition-colors"
              >
                + AGREGAR GRUPO
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
