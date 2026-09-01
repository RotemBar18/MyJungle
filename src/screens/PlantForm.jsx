import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import {
  TextField,
  TextArea,
  SelectField,
  Segmented,
  ChoiceGrid,
  TagInput,
  PhotoPicker,
  useToast,
} from '../components/ui.jsx';
import {
  MEDIUMS,
  DRY_RULES,
  METRICS,
  LIGHT_LEVELS,
  WINDOW_DIRECTIONS,
  POT_MATERIALS,
  POT_TYPES,
  DRAINAGE,
  PROPAGATION_METHODS,
  defaultInterval,
} from '../lib/domain.js';
import { emptyPlant } from '../data/model.js';
import { IdentifySheet } from '../components/identifySheet.jsx';
import { useAi } from '../components/aiSettings.jsx';
import { isoDate } from '../lib/format.js';

export default function PlantForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, lengthUnit, toStoredLength, fromStoredLength } = useI18n();
  const store = useStore();
  const toast = useToast();

  const ai = useAi();
  const existing = id ? store.plantById(id) : null;
  const [p, setP] = useState(() => existing || emptyPlant());
  const [photo, setPhoto] = useState(() => (existing?.photo?.url ? [existing.photo] : []));
  const [error, setError] = useState(null);
  // A new plant starts at the camera when an assistant is connected: the photo
  // fills in the species and care rule, which is the whole point of the pivot.
  const [identifying, setIdentifying] = useState(() => !id && ai.ready);

  // A fixed id per form session: a double tap writes the same document twice.
  const targetId = useMemo(() => id || store.newId('plants'), [id, store]);

  const set = (patch) => setP((v) => ({ ...v, ...patch }));
  const setCare = (patch) => setP((v) => ({ ...v, care: { ...v.care, ...patch } }));
  const setPot = (patch) => setP((v) => ({ ...v, pot: { ...v.pot, ...patch } }));

  const opts = (list, name) => list.map((v) => ({ value: v, label: t(`enum.${name}.${v}`) }));

  const [save, busy] = useSubmit(
    async () => {
      if (!p.name.trim()) {
        setError('name');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setError(null);

      let photoValue = p.photo;
      if (photo[0]?.blob) {
        try {
          photoValue = await store.uploadPhoto(targetId, photo[0].blob, { width: photo[0].w, height: photo[0].h });
        } catch {
          // The profile is worth saving even if the photo could not go up.
          toast(t('gallery.uploadFailedBody'), { type: 'error' });
        }
      } else if (photo.length === 0) {
        photoValue = null;
      }

      await store.savePlant(targetId, {
        ...p,
        name: p.name.trim(),
        photo: photoValue,
        propagation:
          p.kind === 'cutting'
            ? { method: p.propagation?.method || 'water', startedAt: p.propagation?.startedAt || new Date(), outcome: p.propagation?.outcome || 'inProgress' }
            : p.propagation || null,
      });

      photo.forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
      toast(existing ? t('plant.savedChanges') : t('plant.created'));
      nav(`/plant/${targetId}`, { replace: true });
    },
    { onError: () => toast(t('common.error'), { type: 'error' }) },
  );

  const parents = store.plants.filter((x) => x.id !== targetId && x.status === 'active');

  const applyIdentity = ({ patch, photo: shot }) => {
    setP((v) => ({ ...v, ...patch, care: { ...v.care, ...patch.care } }));
    if (shot) setPhoto([{ blob: shot.blob, preview: shot.preview }]);
  };

  return (
    <>
      <TopBar
        back
        title={existing ? t('plant.editTitle') : t('plant.newTitle')}
        actions={
          !existing && ai.ready ? (
            <button className="btn sm soft" onClick={() => setIdentifying(true)}>
              📷 {t('ai.identify')}
            </button>
          ) : null
        }
      />

      <IdentifySheet
        open={identifying}
        onClose={() => setIdentifying(false)}
        onAccept={applyIdentity}
        onManual={() => setIdentifying(false)}
      />
      <main className="content" id="main">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <PhotoPicker label={t('plant.fields.photo')} photos={photo} onChange={setPhoto} max={1} />

          <TextField
            label={t('plant.fields.name')}
            placeholder={t('plant.fields.namePlaceholder')}
            value={p.name}
            error={error === 'name' ? t('common.required') : null}
            onChange={(e) => set({ name: e.target.value })}
            required
          />

          <TextField
            label={t('plant.fields.species')}
            placeholder={t('plant.fields.speciesPlaceholder')}
            value={p.species}
            dir="auto"
            onChange={(e) => set({ species: e.target.value })}
          />

          <Segmented
            label={t('plant.fields.kind')}
            value={p.kind}
            onChange={(kind) => {
              const medium = kind === 'cutting' && p.medium === 'soil' ? 'water' : p.medium;
              const [mn, mx] = defaultInterval(medium, p.care.dryRule);
              setP((v) => ({
                ...v,
                kind,
                medium,
                metrics: kind === 'cutting' && !v.metrics.includes('rootLength') ? [...v.metrics, 'rootLength'] : v.metrics,
                care: { ...v.care, checkMinDays: mn, checkMaxDays: mx },
              }));
            }}
            options={[
              { value: 'plant', label: t('enum.kind.plant') },
              { value: 'cutting', label: t('enum.kind.cutting') },
            ]}
          />

          <div className="grid-2">
            <TextField
              label={t('plant.fields.room')}
              value={p.room}
              list="rooms"
              onChange={(e) => set({ room: e.target.value })}
            />
            <datalist id="rooms">
              {[...new Set(store.plants.map((x) => x.room).filter(Boolean))].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <SelectField
              label={t('plant.fields.medium')}
              value={p.medium}
              onChange={(medium) => {
                const [mn, mx] = defaultInterval(medium, p.care.dryRule);
                setP((v) => ({ ...v, medium, care: { ...v.care, checkMinDays: mn, checkMaxDays: mx } }));
              }}
              options={opts(MEDIUMS, 'medium')}
            />
          </div>

          <Section title={t('plant.sections.careRule')} open>
            <SelectField
              label={t('plant.fields.dryRule')}
              value={p.care.dryRule}
              onChange={(dryRule) => {
                const [mn, mx] = defaultInterval(p.medium, dryRule);
                setCare({ dryRule, checkMinDays: mn, checkMaxDays: mx });
              }}
              options={opts(DRY_RULES, 'dryRule')}
            />
            <div className="grid-2">
              <TextField
                type="number"
                min="1"
                max="120"
                inputMode="numeric"
                label={t('plant.fields.checkMin')}
                value={p.care.checkMinDays}
                onChange={(e) => setCare({ checkMinDays: Number(e.target.value) || 1 })}
              />
              <TextField
                type="number"
                min="1"
                max="180"
                inputMode="numeric"
                label={t('plant.fields.checkMax')}
                value={p.care.checkMaxDays}
                onChange={(e) => setCare({ checkMaxDays: Number(e.target.value) || 1 })}
              />
            </div>
            <TextArea
              label={t('plant.fields.checkNote')}
              placeholder={t('plant.fields.checkNotePlaceholder')}
              value={p.care.checkNote}
              onChange={(e) => setCare({ checkNote: e.target.value })}
            />
            <p className="hint">💡 {t('care.checkNotWater')}</p>
          </Section>

          <Section title={t('plant.sections.place')}>
            <TextField
              label={t('plant.fields.location')}
              placeholder={t('plant.fields.locationPlaceholder')}
              value={p.location}
              onChange={(e) => set({ location: e.target.value })}
            />
            <div className="grid-2">
              <SelectField label={t('plant.fields.light')} value={p.light} onChange={(light) => set({ light })} options={opts(LIGHT_LEVELS, 'light')} />
              <SelectField
                label={t('plant.fields.windowDirection')}
                value={p.windowDirection}
                onChange={(windowDirection) => set({ windowDirection })}
                options={opts(WINDOW_DIRECTIONS, 'windowDirection')}
              />
            </div>
          </Section>

          <Section title={t('plant.sections.pot')}>
            <div className="grid-2">
              <SelectField label={t('plant.fields.potType')} value={p.pot.type} allowEmpty onChange={(type) => setPot({ type })} options={opts(POT_TYPES, 'potType')} />
              <SelectField label={t('plant.fields.potMaterial')} value={p.pot.material} allowEmpty onChange={(material) => setPot({ material })} options={opts(POT_MATERIALS, 'potMaterial')} />
              <TextField
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                label={`${t('plant.fields.potSize')} (${lengthUnit()})`}
                value={fromStoredLength(p.pot.sizeCm) === '' ? '' : fromStoredLength(p.pot.sizeCm)}
                onChange={(e) => setPot({ sizeCm: e.target.value === '' ? null : toStoredLength(Number(e.target.value)) })}
              />
              <SelectField label={t('plant.fields.drainage')} value={p.drainage} onChange={(drainage) => set({ drainage })} options={opts(DRAINAGE, 'drainage')} />
            </div>
            <TextField
              label={t('plant.fields.substrate')}
              placeholder={t('plant.fields.substratePlaceholder')}
              value={p.substrate}
              onChange={(e) => set({ substrate: e.target.value })}
            />
          </Section>

          <Section title={t('plant.sections.tracking')}>
            <ChoiceGrid
              label={t('plant.fields.metrics')}
              hint={t('plant.fields.metricsHint')}
              multiple
              value={p.metrics}
              onChange={(metrics) => set({ metrics })}
              options={METRICS.map((m) => ({ value: m, label: t(`enum.metric.${m}`) }))}
            />
          </Section>

          <Section title={t('plant.sections.origin')} open={p.kind === 'cutting'}>
            <div className="grid-2">
              <TextField
                type="date"
                max={isoDate()}
                label={t('plant.fields.acquiredAt')}
                value={p.acquiredAt ? String(p.acquiredAt).slice(0, 10) : ''}
                onChange={(e) => set({ acquiredAt: e.target.value || null })}
              />
              <TextField
                label={t('plant.fields.source')}
                placeholder={t('plant.fields.sourcePlaceholder')}
                value={p.source}
                onChange={(e) => set({ source: e.target.value })}
              />
            </div>
            <SelectField
              label={t('plant.fields.parent')}
              value={p.parentId || ''}
              allowEmpty
              emptyLabel={t('plant.fields.parentNone')}
              onChange={(parentId) => set({ parentId: parentId || null })}
              options={parents.map((x) => ({ value: x.id, label: x.name }))}
            />
            {p.kind === 'cutting' && (
              <SelectField
                label={t('plant.fields.propMethod')}
                value={p.propagation?.method || 'water'}
                onChange={(method) => set({ propagation: { ...(p.propagation || {}), method } })}
                options={opts(PROPAGATION_METHODS, 'propagationMethod')}
              />
            )}
          </Section>

          <Section title={t('plant.sections.extra')}>
            <TextField label={t('plant.fields.cultivar')} value={p.cultivar} dir="auto" onChange={(e) => set({ cultivar: e.target.value })} />
            <TagInput
              label={t('plant.fields.tags')}
              value={p.tags}
              onChange={(tags) => set({ tags })}
              placeholder={t('plant.fields.tagsPlaceholder')}
            />
            <TextArea label={t('plant.fields.notes')} value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Section>

          <div className="row" style={{ gap: 9, marginBlockStart: 18 }}>
            <button type="button" className="btn grow" onClick={() => nav(-1)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn primary grow" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </div>
          {existing && <p className="tiny muted center" style={{ marginBlockStart: 10 }}>{t('plant.historySafe')}</p>}
        </form>
      </main>
    </>
  );
}

/** Native disclosure — free keyboard support, free screen-reader semantics. */
function Section({ title, children, open }) {
  return (
    <details open={open} style={{ marginBlock: 14, borderTop: '1px solid var(--line)', paddingBlockStart: 14 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 15,
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {title}
      </summary>
      <div style={{ paddingBlockStart: 12 }}>{children}</div>
    </details>
  );
}
