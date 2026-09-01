import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import {
  Sheet,
  TextField,
  TextArea,
  SelectField,
  Segmented,
  PhotoPicker,
  useToast,
  Bidi,
} from './ui.jsx';
import {
  EVENT_TYPES,
  EVENT_GROUPS,
  eventType,
  SOIL_STATES,
  HEALTH_ISSUES,
  PEST_KINDS,
  FERTILIZER_TYPES,
  APPLICATION_METHODS,
  ROOT_CONDITIONS,
  PLANT_STATUS,
  METRIC_UNITS,
} from '../lib/domain.js';
import { isoDate, isoTime, combineDateTime } from '../lib/format.js';
import { waterEventType } from '../data/model.js';
import { photoErrorKey, photoErrorDetail } from '../lib/photoError.js';

/**
 * Every event type is described as a list of fields rather than as its own
 * form component. Adding a type is a line in `domain.js` plus (optionally) a
 * line here — the sheet, validation, photos and saving are shared.
 */
function fieldsFor(type, plant) {
  const isWater = plant.medium === 'water' || plant.medium === 'leca';
  switch (type) {
    case 'water':
    case 'waterChange':
      return [
        isWater
          ? { key: 'percent', kind: 'number', label: 'water.amountChange', suffix: 'units.pct', min: 0, max: 100 }
          : { key: 'amountMl', kind: 'volume', label: 'water.amount' },
        {
          key: 'soil',
          kind: 'select',
          label: isWater ? 'water.waterBefore' : 'water.soilBefore',
          options: SOIL_STATES,
          enumName: 'soilState',
        },
        !isWater && {
          key: 'drained',
          kind: 'segmented',
          label: 'water.drained',
          choices: [
            { value: 'yes', labelKey: 'water.drainedYes' },
            { value: 'no', labelKey: 'water.drainedNo' },
            { value: '', labelKey: 'water.drainedUnknown' },
          ],
        },
      ].filter(Boolean);

    case 'check':
      return [
        {
          key: 'soil',
          kind: 'select',
          label: isWater ? 'water.waterBefore' : 'water.soilBefore',
          options: SOIL_STATES,
          enumName: 'soilState',
        },
      ];

    case 'fertilize':
      return [
        { key: 'product', kind: 'text', label: 'fert.product', placeholder: 'fert.productPlaceholder' },
        { key: 'fertType', kind: 'select', label: 'fert.type', options: FERTILIZER_TYPES, enumName: 'fertilizerType' },
        { key: 'dose', kind: 'text', label: 'fert.dose', placeholder: 'fert.dosePlaceholder' },
        { key: 'dilution', kind: 'text', label: 'fert.dilution', placeholder: 'fert.dilutionPlaceholder' },
        { key: 'method', kind: 'select', label: 'fert.method', options: APPLICATION_METHODS, enumName: 'applicationMethod' },
      ];

    case 'growth':
      return [{ key: 'values', kind: 'metrics' }];

    case 'repot':
      return [
        { key: 'fromSizeCm', kind: 'length', label: 'repot.fromSize' },
        { key: 'toSizeCm', kind: 'length', label: 'repot.toSize' },
        { key: 'fromSubstrate', kind: 'text', label: 'repot.fromSubstrate' },
        { key: 'toSubstrate', kind: 'text', label: 'repot.toSubstrate' },
        { key: 'rootCondition', kind: 'select', label: 'repot.rootCondition', options: ROOT_CONDITIONS, enumName: 'rootCondition' },
        { key: 'rootTreatment', kind: 'text', label: 'repot.rootTreatment', placeholder: 'repot.rootTreatmentPlaceholder' },
      ];

    case 'soilChange':
      return [
        { key: 'fromSubstrate', kind: 'text', label: 'repot.fromSubstrate' },
        { key: 'toSubstrate', kind: 'text', label: 'repot.toSubstrate' },
        { key: 'rootCondition', kind: 'select', label: 'repot.rootCondition', options: ROOT_CONDITIONS, enumName: 'rootCondition' },
      ];

    case 'health':
      return [
        { key: 'issue', kind: 'select', label: 'health.issue', options: HEALTH_ISSUES, enumName: 'healthIssue', required: true },
        {
          key: 'severity',
          kind: 'segmented',
          label: 'health.severity',
          choices: [
            { value: 'mild', labelKey: 'health.severities.mild' },
            { value: 'moderate', labelKey: 'health.severities.moderate' },
            { value: 'severe', labelKey: 'health.severities.severe' },
          ],
        },
        { key: 'action', kind: 'text', label: 'health.action', placeholder: 'health.actionPlaceholder' },
      ];

    case 'healthUpdate':
      return [
        {
          key: 'outcome',
          kind: 'segmented',
          label: 'health.outcome',
          choices: [
            { value: 'better', labelKey: 'health.outcomes.better' },
            { value: 'same', labelKey: 'health.outcomes.same' },
            { value: 'worse', labelKey: 'health.outcomes.worse' },
            { value: 'resolved', labelKey: 'health.outcomes.resolved' },
          ],
        },
        { key: 'action', kind: 'text', label: 'health.action', placeholder: 'health.actionPlaceholder' },
      ];

    case 'pest':
      return [
        { key: 'pest', kind: 'select', label: 'event.pest', options: PEST_KINDS, enumName: 'pest' },
        { key: 'treatment', kind: 'text', label: 'event.treatment', placeholder: 'event.treatmentPlaceholder' },
      ];

    case 'treatment':
      return [{ key: 'treatment', kind: 'text', label: 'event.treatment', placeholder: 'event.treatmentPlaceholder' }];

    case 'rootCheck':
    case 'rootWash':
    case 'rootPrune':
    case 'rootRot':
      return [
        { key: 'rootCondition', kind: 'select', label: 'repot.rootCondition', options: ROOT_CONDITIONS, enumName: 'rootCondition' },
        { key: 'observation', kind: 'text', label: 'event.rootObservation' },
      ];

    case 'rooted':
      return [{ key: 'rootLengthCm', kind: 'length', label: 'prop.rootLength' }];

    case 'move':
      return [
        { key: 'toRoom', kind: 'text', label: 'plant.fields.room' },
        { key: 'toLocation', kind: 'text', label: 'plant.fields.location', placeholder: 'plant.fields.locationPlaceholder' },
      ];

    case 'status':
      return [
        {
          key: 'status',
          kind: 'select',
          label: 'plant.fields.status',
          options: PLANT_STATUS,
          enumName: 'plantStatus',
          required: true,
        },
      ];

    case 'custom':
      return [{ key: 'title', kind: 'text', label: 'event.customName', placeholder: 'event.customNamePlaceholder', required: true }];

    default:
      return [];
  }
}

/** Profile updates that must follow certain events so the card stays truthful. */
function plantPatchFor(type, data, plant, photos = []) {
  // A plant with no picture yet adopts the first photo attached to any event, so
  // the card and hero stop showing a placeholder without a trip to the edit form.
  const adopt = !plant.photo?.url && photos[0]?.url ? { photo: photos[0] } : null;
  const withPhoto = (patch) => (adopt || patch ? { ...adopt, ...patch } : null);

  switch (type) {
    case 'move':
      return withPhoto({ room: data.toRoom ?? plant.room, location: data.toLocation ?? plant.location });
    case 'repot':
      return withPhoto({
        pot: { ...plant.pot, sizeCm: data.toSizeCm ?? plant.pot.sizeCm },
        substrate: data.toSubstrate || plant.substrate,
      });
    case 'soilChange':
      return withPhoto({ substrate: data.toSubstrate || plant.substrate });
    case 'rooted':
      return withPhoto({ propagation: { ...(plant.propagation || {}), outcome: 'rooted' } });
    case 'potted':
      return withPhoto({ medium: 'soil', propagation: { ...(plant.propagation || {}), outcome: 'potted' } });
    case 'status':
      return withPhoto(data.status ? { status: data.status } : null);
    default:
      return withPhoto(null);
  }
}

export function EventSheet({ open, onClose, plant, type: initialType, issue, onSaved }) {
  const { t, lengthUnit, volumeUnit, toStoredLength, toStoredVolume } = useI18n();
  const store = useStore();
  const toast = useToast();

  const [type, setType] = useState(initialType || 'note');
  const [picking, setPicking] = useState(!initialType);
  const [date, setDate] = useState(isoDate());
  const [time, setTime] = useState(isoTime());
  const [data, setData] = useState(() => seedData(initialType, plant));
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState(null);

  // One id per open sheet: tapping save twice writes the same document twice
  // instead of creating two records.
  const eventId = useMemo(() => (open ? store.newId('events') : null), [open, store]);

  const fields = fieldsFor(type, plant);
  const meta = eventType(type);

  const reset = (nextType) => {
    setType(nextType);
    setData(seedData(nextType, plant));
    setError(null);
    setPicking(false);
  };

  const [save, busy] = useSubmit(async () => {
    const missing = fields.find((f) => f.required && !data[f.key]);
    if (missing) {
      setError(missing.key);
      return;
    }
    setError(null);

    // Upload first so a failure does not silently drop the photo, but never
    // block the record itself: the entry is saved either way.
    let uploaded = [];
    let failure = null;
    for (const p of photos) {
      try {
        uploaded.push(p.url ? p : await store.uploadPhoto(plant.id, p.blob, { width: p.w, height: p.h }));
      } catch (err) {
        console.error(err);
        failure = err;
      }
    }

    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== '' && v != null),
    );

    await store.addEvent(
      plant.id,
      {
        type,
        at: combineDateTime(date, time),
        data: clean,
        note: note.trim(),
        photos: uploaded,
        ref: issue?.id || null,
      },
      eventId,
    );

    const patch = plantPatchFor(type, clean, plant, uploaded);
    if (patch) await store.savePlant(plant.id, patch);

    photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    toast(
      failure ? `${t(photoErrorKey(failure))} ${photoErrorDetail(failure)}` : savedMessage(type, t),
      failure ? { type: 'error' } : {},
    );
    onSaved?.(type);
    onClose();
  });

  if (!open) return null;

  const title = picking
    ? t('event.pick')
    : issue
      ? t('health.updateTitle')
      : `${meta.icon} ${t(`enum.eventType.${type}`)}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        picking ? null : (
          <>
            <button className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </>
        )
      }
    >
      {picking ? (
        <TypePicker plant={plant} onPick={reset} />
      ) : (
        <>
          {issue && (
            <p className="small muted" style={{ marginBlockEnd: 12 }}>
              <Bidi>{t(`enum.healthIssue.${issue.data?.issue || 'other'}`)}</Bidi>
            </p>
          )}

          <div className="grid-2">
            <TextField
              type="date"
              label={t('common.date')}
              value={date}
              max={isoDate()}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              type="time"
              label={t('common.time')}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {fields.map((f) => (
            <EventField
              key={f.key}
              field={f}
              plant={plant}
              value={data[f.key]}
              error={error === f.key ? t('common.required') : null}
              onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
              t={t}
              units={{ lengthUnit, volumeUnit, toStoredLength, toStoredVolume }}
            />
          ))}

          <TextArea
            label={type === 'health' ? t('health.symptoms') : t('common.notes')}
            placeholder={type === 'health' ? t('health.symptomsPlaceholder') : ''}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <PhotoPicker label={t('common.photos')} photos={photos} onChange={setPhotos} />

          {!initialType && (
            <button className="btn ghost sm" onClick={() => setPicking(true)}>
              ← {t('event.pick')}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

/**
 * One-tap watering from anywhere a plant is listed.
 * Returns [openFor(plant), sheetElement].
 */
export function useQuickLog() {
  const [target, setTarget] = useState(null);
  const sheet = target ? (
    <EventSheet
      open
      plant={target}
      type={waterEventType(target)}
      onClose={() => setTarget(null)}
    />
  ) : null;
  return [setTarget, sheet];
}

function seedData(type, plant) {
  if (type === 'move') return { fromRoom: plant.room, toRoom: plant.room, toLocation: plant.location };
  if (type === 'repot') return { fromSizeCm: plant.pot?.sizeCm ?? '', fromSubstrate: plant.substrate };
  if (type === 'soilChange') return { fromSubstrate: plant.substrate };
  if (type === 'health') return { severity: 'moderate' };
  if (type === 'healthUpdate') return { outcome: 'better' };
  if (type === 'status') return { status: plant.status };
  return {};
}

function savedMessage(type, t) {
  if (type === 'water') return t('water.saved');
  if (type === 'waterChange') return t('water.savedChange');
  if (type === 'check') return t('water.checkedSaved');
  if (type === 'fertilize') return t('fert.saved');
  if (type === 'growth') return t('growth.saved');
  if (type === 'repot') return t('repot.saved');
  if (type === 'health') return t('health.saved');
  return t('timeline.eventSaved');
}

function EventField({ field: f, plant, value, onChange, error, t, units }) {
  if (f.kind === 'metrics') return <MetricsFields plant={plant} values={value || {}} onChange={onChange} />;

  if (f.kind === 'select')
    return (
      <SelectField
        label={t(f.label)}
        value={value ?? ''}
        allowEmpty
        emptyLabel={t('common.none')}
        onChange={onChange}
        options={f.options.map((o) => ({ value: o, label: t(`enum.${f.enumName}.${o}`) }))}
        hint={error}
      />
    );

  if (f.kind === 'segmented')
    return (
      <Segmented
        label={t(f.label)}
        value={value ?? ''}
        onChange={onChange}
        options={f.choices.map((c) => ({ value: c.value, label: t(c.labelKey) }))}
      />
    );

  if (f.kind === 'textarea')
    return <TextArea label={t(f.label)} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;

  if (f.kind === 'length' || f.kind === 'volume' || f.kind === 'number') {
    const suffix =
      f.kind === 'length' ? units.lengthUnit() : f.kind === 'volume' ? units.volumeUnit() : f.suffix ? t(f.suffix) : '';
    return (
      <TextField
        type="number"
        inputMode="decimal"
        step="0.1"
        min={f.min ?? 0}
        max={f.max}
        label={`${t(f.label)}${suffix ? ` (${suffix})` : ''}`}
        value={value ?? ''}
        error={error}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange('');
          const n = Number(raw);
          onChange(
            f.kind === 'length'
              ? units.toStoredLength(n)
              : f.kind === 'volume'
                ? units.toStoredVolume(n)
                : n,
          );
        }}
      />
    );
  }

  return (
    <TextField
      label={t(f.label)}
      placeholder={f.placeholder ? t(f.placeholder) : undefined}
      value={value ?? ''}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function MetricsFields({ plant, values, onChange }) {
  const { t, lengthUnit, toStoredLength, fromStoredLength } = useI18n();
  if (!plant.metrics?.length)
    return <p className="small muted">{t('growth.noMetrics')}</p>;
  return (
    <div className="grid-2">
      {plant.metrics.map((m) => {
        const isLength = METRIC_UNITS[m] === 'length';
        const shown = isLength ? fromStoredLength(values[m] ?? null) : (values[m] ?? '');
        return (
          <TextField
            key={m}
            type="number"
            inputMode="decimal"
            step={isLength ? '0.1' : '1'}
            min="0"
            label={`${t(`enum.metric.${m}`)}${isLength ? ` (${lengthUnit()})` : ''}`}
            value={shown === null ? '' : shown}
            onChange={(e) => {
              const raw = e.target.value;
              const next = { ...values };
              if (raw === '') delete next[m];
              else next[m] = isLength ? toStoredLength(Number(raw)) : Number(raw);
              onChange(next);
            }}
          />
        );
      })}
    </div>
  );
}

function TypePicker({ plant, onPick }) {
  const { t } = useI18n();
  const preferred = waterEventType(plant);
  return (
    <div>
      {EVENT_GROUPS.map((g) => {
        const list = EVENT_TYPES.filter((e) => e.group === g).filter(
          (e) => !(e.id === 'water' && preferred === 'waterChange') && !(e.id === 'waterChange' && preferred === 'water'),
        );
        if (!list.length) return null;
        return (
          <div key={g} style={{ marginBlockEnd: 16 }}>
            <div className="lbl" style={{ marginBlockEnd: 7 }}>
              {t(`enum.eventGroup.${g}`)}
            </div>
            <div className="choice-grid">
              {list.map((e) => (
                <button key={e.id} type="button" className="choice" onClick={() => onPick(e.id)}>
                  <span className="ic" aria-hidden="true">
                    {e.icon}
                  </span>
                  <span className="grow">{t(`enum.eventType.${e.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
