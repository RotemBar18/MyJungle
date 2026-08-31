import { useMemo, useState, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { PlantCard } from '../components/plant.jsx';
import { EmptyState, Sheet, SelectField, Segmented } from '../components/ui.jsx';
import { useQuickLog } from '../components/eventSheet.jsx';
import { IconFilter, IconPlus } from '../components/icons.jsx';

const QUICK = [
  'needsAttention', 'hasIssue', 'favorites', 'cuttings', 'notWateredLong',
  'recentlyWatered', 'healthy', 'rooted', 'archived',
];

const SORTS = ['attention', 'name', 'lastWatered', 'recentlyAdded', 'room'];

export default function Jungle() {
  const { t, locale } = useI18n();
  const store = useStore();
  const { plants, stats, attention, eventsByPlant } = store;
  const [openQuickLog, quickLogSheet] = useQuickLog();

  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim().toLowerCase());
  const [quick, setQuick] = useState(null);
  const [filters, setFilters] = useState({ room: '', medium: '', species: '', tag: '' });
  const [sort, setSort] = useState('attention');
  const [sheet, setSheet] = useState(false);

  const facets = useMemo(() => {
    const rooms = new Set();
    const species = new Set();
    const tags = new Set();
    const mediums = new Set();
    for (const p of plants) {
      if (p.room) rooms.add(p.room);
      if (p.species) species.add(p.species);
      if (p.medium) mediums.add(p.medium);
      p.tags.forEach((x) => tags.add(x));
    }
    const sorted = (s) => [...s].sort((a, b) => a.localeCompare(b, locale));
    return { rooms: sorted(rooms), species: sorted(species), tags: sorted(tags), mediums: [...mediums] };
  }, [plants, locale]);

  const list = useMemo(() => {
    const matches = (p) => {
      if (!query) return true;
      const hay = [
        p.name, p.species, p.cultivar, p.room, p.location, p.notes, p.source,
        ...p.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(query)) return true;
      // notes written on events are searchable too — that is where the real
      // observations end up.
      return (eventsByPlant.get(p.id) || []).some((e) =>
        (e.note || '').toLowerCase().includes(query),
      );
    };

    const passesQuick = (p) => {
      const s = stats.get(p.id);
      switch (quick) {
        case 'needsAttention':
          return !!attention.get(p.id);
        case 'hasIssue':
          return s.openIssues.length > 0;
        case 'healthy':
          return s.openIssues.length === 0 && (s.state === 'fine' || s.state === 'check');
        case 'recentlyWatered':
          return s.daysSinceWater != null && s.daysSinceWater <= 3;
        case 'notWateredLong':
          return s.daysSinceWater == null || s.daysSinceWater >= s.window[1];
        case 'cuttings':
          return p.kind === 'cutting';
        case 'rooted':
          return !!s.propagation.rootedAt;
        case 'favorites':
          return p.favorite;
        case 'archived':
          return p.status !== 'active';
        default:
          return true;
      }
    };

    const passesFacets = (p) =>
      (!filters.room || p.room === filters.room) &&
      (!filters.medium || p.medium === filters.medium) &&
      (!filters.species || p.species === filters.species) &&
      (!filters.tag || p.tags.includes(filters.tag));

    const base = plants.filter(
      (p) => (quick === 'archived' ? p.status !== 'active' : p.status === 'active'),
    );

    const out = base.filter((p) => matches(p) && passesQuick(p) && passesFacets(p));

    const cmp = {
      attention: (a, b) =>
        (attention.get(b.id)?.score || 0) - (attention.get(a.id)?.score || 0) ||
        a.name.localeCompare(b.name, locale),
      name: (a, b) => a.name.localeCompare(b.name, locale),
      room: (a, b) => (a.room || '').localeCompare(b.room || '', locale) || a.name.localeCompare(b.name, locale),
      recentlyAdded: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      lastWatered: (a, b) => {
        const da = stats.get(a.id).daysSinceWater;
        const dbb = stats.get(b.id).daysSinceWater;
        return (dbb ?? 9e3) - (da ?? 9e3);
      },
    }[sort];

    return out.sort(cmp);
  }, [plants, stats, attention, eventsByPlant, query, quick, filters, sort, locale]);

  const activeFilters = Object.values(filters).filter(Boolean).length + (sort !== 'attention' ? 1 : 0);

  return (
    <>
      <TopBar
        title={t('plants.title')}
        actions={
          <Link className="btn icon" to="/new" aria-label={t('plants.addPlant')}>
            <IconPlus />
          </Link>
        }
      />
      <main className="content" id="main">
        <div className="row" style={{ marginBlock: '4px 12px' }}>
          <input
            type="search"
            className="grow"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('common.search')}
          />
          <button
            className="btn icon filled"
            onClick={() => setSheet(true)}
            aria-label={t('search.filterTitle')}
            style={{ position: 'relative' }}
          >
            <IconFilter />
            {activeFilters > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  insetBlockStart: 2,
                  insetInlineEnd: 2,
                  inlineSize: 9,
                  blockSize: 9,
                  borderRadius: '50%',
                  background: 'var(--green)',
                }}
              />
            )}
          </button>
        </div>

        <div className="scroller" style={{ marginBlockEnd: 14 }}>
          <button className={`chip${!quick ? ' on' : ''}`} onClick={() => setQuick(null)}>
            {t('common.all')}
          </button>
          {QUICK.map((k) => (
            <button
              key={k}
              className={`chip${quick === k ? ' on' : ''}`}
              onClick={() => setQuick(quick === k ? null : k)}
            >
              {t(`search.quick.${k}`)}
            </button>
          ))}
        </div>

        <p className="small muted" style={{ marginBlockEnd: 10 }}>
          {list.length === 1 ? t('search.resultOne') : t('search.results', { n: list.length })}
        </p>

        {list.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title={plants.length ? t('plants.noResults') : t('plants.empty')}
            body={plants.length ? t('plants.noResultsBody') : t('plants.emptyBody')}
            action={
              <Link className="btn primary" to="/new">
                {t('plants.addPlant')}
              </Link>
            }
          />
        ) : (
          <div className="plant-grid">
            {list.map((p) => (
              <PlantCard key={p.id} plant={p} stats={stats.get(p.id)} onQuickLog={openQuickLog} />
            ))}
          </div>
        )}
      </main>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('search.filterTitle')}
        footer={
          <>
            <button
              className="btn"
              onClick={() => {
                setFilters({ room: '', medium: '', species: '', tag: '' });
                setSort('attention');
              }}
            >
              {t('common.reset')}
            </button>
            <button className="btn primary" onClick={() => setSheet(false)}>
              {t('common.done')}
            </button>
          </>
        }
      >
        <Segmented
          label={t('common.sort')}
          value={sort}
          onChange={setSort}
          options={SORTS.slice(0, 3).map((s) => ({ value: s, label: t(`search.sortBy.${s}`) }))}
        />
        <SelectField
          label={t('search.filters.room')}
          value={filters.room}
          allowEmpty
          emptyLabel={t('common.all')}
          onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
          options={facets.rooms.map((r) => ({ value: r, label: r }))}
        />
        <SelectField
          label={t('search.filters.species')}
          value={filters.species}
          allowEmpty
          emptyLabel={t('common.all')}
          onChange={(v) => setFilters((f) => ({ ...f, species: v }))}
          options={facets.species.map((r) => ({ value: r, label: r }))}
        />
        <SelectField
          label={t('search.filters.medium')}
          value={filters.medium}
          allowEmpty
          emptyLabel={t('common.all')}
          onChange={(v) => setFilters((f) => ({ ...f, medium: v }))}
          options={facets.mediums.map((r) => ({ value: r, label: t(`enum.medium.${r}`) }))}
        />
        {facets.tags.length > 0 && (
          <SelectField
            label={t('search.filters.tag')}
            value={filters.tag}
            allowEmpty
            emptyLabel={t('common.all')}
            onChange={(v) => setFilters((f) => ({ ...f, tag: v }))}
            options={facets.tags.map((r) => ({ value: r, label: r }))}
          />
        )}
      </Sheet>
      {quickLogSheet}
    </>
  );
}
