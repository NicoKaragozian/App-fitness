import React, { useEffect } from 'react';
import { useSessionDetail } from '../hooks/useSessionDetail';

const HR_ZONE_COLORS = ['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171'];
const HR_ZONE_LABELS = ['Z1 Recuperación', 'Z2 Base aeróbica', 'Z3 Aeróbico', 'Z4 Umbral', 'Z5 Máximo'];

const TRAINING_EFFECT_LABELS: Record<string, string> = {
  RECOVERY: 'Recuperación',
  BASE: 'Base',
  TEMPO: 'Tempo',
  THRESHOLD: 'Umbral',
  SPEED: 'Velocidad',
  ANAEROBIC: 'Anaeróbico',
  VO2MAX: 'VO₂ Máx',
  MAINTAINING_AEROBIC_FITNESS: 'Mantiene fitness aeróbico',
  IMPROVING_AEROBIC_FITNESS: 'Mejora fitness aeróbico',
  IMPROVING_ANAEROBIC_CAPACITY_AND_SPEED: 'Mejora capacidad anaeróbica',
};

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  return m > 0 ? `${m}m` : `${secs}s`;
}

function resolveLabel(raw: string | null): string {
  if (!raw) return '';
  // Try exact match, then prefix match
  if (TRAINING_EFFECT_LABELS[raw]) return TRAINING_EFFECT_LABELS[raw];
  const key = Object.keys(TRAINING_EFFECT_LABELS).find((k) => raw.startsWith(k));
  return key ? TRAINING_EFFECT_LABELS[key] : raw.replace(/_/g, ' ').toLowerCase();
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  color?: string;
}

function Metric({ label, value, unit, color }: MetricProps) {
  return (
    <div className="bg-surface rounded-xl p-4">
      <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">{label}</p>
      <p className="font-display font-bold text-2xl" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="text-on-surface-variant text-sm font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

interface SessionModalProps {
  activityId: string;
  groupColor: string;
  groupIcon: string;
  onClose: () => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({ activityId, groupColor, groupIcon, onClose }) => {
  const { data, loading } = useSessionDetail(activityId);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasHrZones = data?.hrZones?.some((z) => z.seconds > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-low w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-low border-b border-outline-variant/20 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span style={{ color: groupColor }}>{groupIcon}</span>
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {data?.sportType?.replace(/_v\d+$/, '').replace(/_/g, ' ').toUpperCase() ?? '—'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center text-on-surface-variant font-label text-label-sm">Cargando...</div>
        )}

        {data && !loading && (
          <div className="p-5 space-y-6">
            {/* Title + location */}
            <div>
              <h2 className="font-display font-bold text-on-surface text-2xl leading-tight">{data.name}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="font-label text-label-sm text-on-surface-variant">{data.date}</span>
                {data.locationName && (
                  <>
                    <span className="text-on-surface-variant opacity-40">·</span>
                    <span className="font-label text-label-sm text-on-surface-variant">📍 {data.locationName}</span>
                  </>
                )}
                {data.lapCount != null && data.lapCount > 1 && (
                  <>
                    <span className="text-on-surface-variant opacity-40">·</span>
                    <span className="font-label text-label-sm text-on-surface-variant">{data.lapCount} vueltas</span>
                  </>
                )}
              </div>
            </div>

            {/* Performance metrics */}
            <div>
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">RENDIMIENTO</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Metric label="DURACIÓN" value={fmtDuration(data.duration)} color={groupColor} />
                {data.distance > 0 && <Metric label="DISTANCIA" value={data.distance} unit="KM" />}
                {data.avgSpeed != null && <Metric label="VEL. PROM." value={data.avgSpeed} unit="KM/H" />}
                {data.maxSpeed != null && <Metric label="VEL. MÁX." value={data.maxSpeed} unit="KM/H" />}
                {data.avgHr != null && <Metric label="FC PROM." value={data.avgHr} unit="BPM" />}
                {data.maxHr != null && <Metric label="FC MÁX." value={data.maxHr} unit="BPM" />}
                {data.calories != null && data.calories > 0 && <Metric label="CALORÍAS" value={data.calories} unit="KCAL" />}
              </div>
            </div>

            {/* HR Zones */}
            {hasHrZones && (
              <div>
                <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">ZONAS DE FC</p>
                <div className="space-y-2">
                  {data.hrZones.map((z, i) => (
                    <div key={z.zone} className="flex items-center gap-3">
                      <span className="font-label text-label-sm w-4 text-on-surface-variant">{z.zone}</span>
                      <div className="flex-1 bg-surface rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${z.pct}%`,
                            background: HR_ZONE_COLORS[i],
                            opacity: z.seconds > 0 ? 0.85 : 0.15,
                          }}
                        />
                      </div>
                      <span className="font-label text-label-sm text-on-surface w-10 text-right">
                        {z.seconds > 0 ? fmtSeconds(z.seconds) : '—'}
                      </span>
                      <span className="font-label text-label-sm text-on-surface-variant w-28 hidden sm:block">
                        {HR_ZONE_LABELS[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Training effect */}
            {(data.aerobicEffect != null || data.trainingLoad != null) && (
              <div>
                <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">EFECTO DE ENTRENAMIENTO</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.aerobicEffect != null && (
                    <Metric label="AERÓBICO" value={data.aerobicEffect} />
                  )}
                  {data.anaerobicEffect != null && (
                    <Metric label="ANAERÓBICO" value={data.anaerobicEffect} />
                  )}
                  {data.trainingLoad != null && (
                    <Metric label="CARGA" value={data.trainingLoad} />
                  )}
                  {data.differenceBodyBattery != null && (
                    <Metric
                      label="BATERÍA"
                      value={`${data.differenceBodyBattery > 0 ? '+' : ''}${data.differenceBodyBattery}`}
                      color={data.differenceBodyBattery >= 0 ? '#4ade80' : '#fb923c'}
                    />
                  )}
                </div>
                {data.trainingEffectLabel && (
                  <p className="font-label text-label-sm text-on-surface-variant mt-2">
                    {resolveLabel(data.trainingEffectLabel)}
                  </p>
                )}
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={data.garminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase transition-colors"
              >
                Ver en Garmin Connect ↗
              </a>
              {data.mapUrl && (
                <a
                  href={data.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase transition-colors"
                >
                  Ver ubicación ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
