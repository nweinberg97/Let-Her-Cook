import { useEffect, useId, useState } from 'react';
import { Download, Upload, HardDrive, ShieldCheck, Trash2, Server, AlertTriangle } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { storageErrorMessage, type DuplicateStrategy } from '../lib/storage/repository';
import { BackupError, MAX_BACKUP_BYTES, backupFileName, countDuplicates, parseBackupText, type ParsedBackup } from '../lib/storage/backup';
import { downloadFile } from '../lib/export/download';
import { readBlobText } from '../lib/files/validate';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { usePageTitle } from '../lib/usePageTitle';

const STRATEGY_COPY: Record<DuplicateStrategy, { label: string; hint: string }> = {
  skip: { label: 'Keep the versions I have now', hint: 'Recipes already here are left alone; only new ones are added.' },
  replace: { label: 'Use the versions from the backup', hint: 'Recipes already here are overwritten with the backup copy.' },
  'keep-both': { label: 'Keep both', hint: 'Backup copies are added alongside, so you may see a recipe twice.' }
};

function formatBytes(n: number): string {
  if (n > 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function DataPage() {
  usePageTitle('Backup & privacy');
  const { repo, recipes, collections, preferences } = useLibrary();
  const toast = useToast();
  const fileId = useId();
  const [preview, setPreview] = useState<ParsedBackup | null>(null);
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [importing, setImporting] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const storageApi = typeof navigator !== 'undefined' && navigator.storage;

  useEffect(() => {
    if (!storageApi) return;
    storageApi.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    storageApi.estimate?.().then((e) => setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => undefined);
  }, [storageApi, recipes.length]);

  const exportBackup = async () => {
    try {
      const backup = await repo.exportBackup();
      downloadFile(JSON.stringify(backup, null, 2), backupFileName());
      await repo.updatePreferences({ lastBackupAt: new Date().toISOString() });
      toast.success(`Backup downloaded: ${backup.recipes.length} recipes, ${backup.collections.length} collections.`);
    } catch (err) {
      toast.error(`We couldn’t create the backup. ${storageErrorMessage(err)}`);
    }
  };

  const readBackup = async (file: File) => {
    setRestoreError(null);
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setRestoreError('Choose a .json backup file you downloaded from Let Her Cook.');
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      setRestoreError('That file is too large to be a Let Her Cook backup.');
      return;
    }
    try {
      const parsed = parseBackupText(await readBlobText(file));
      setStrategy('skip');
      setPreview(parsed);
    } catch (err) {
      setRestoreError(err instanceof BackupError ? err.message : 'We couldn’t read that file. Your existing recipes are untouched.');
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await repo.importBackup({ recipes: preview.recipes, collections: preview.collections, preferences: preview.preferences, duplicateStrategy: strategy });
      const parts = [`${result.added} added`];
      if (result.replaced) parts.push(`${result.replaced} replaced`);
      if (result.skipped) parts.push(`${result.skipped} already here`);
      toast.success(`Backup restored: ${parts.join(', ')}.`);
      setPreview(null);
    } catch (err) {
      toast.error(`Nothing was restored. ${storageErrorMessage(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const dupCount = preview ? countDuplicates(preview.recipes, recipes) : 0;
  const lastBackup = preferences.lastBackupAt ? new Date(preferences.lastBackupAt) : null;

  return (
    <div className="page data-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Backup &amp; privacy</h1>
          <p className="page-lede">Your recipes live in this browser, on this device. Here’s how to keep them safe and take them with you.</p>
        </div>
      </header>

      <div className="data-grid">
        <section className="data-card data-card--butter" aria-labelledby="backup-h">
          <Download size={24} aria-hidden="true" className="data-card__icon" />
          <h2 id="backup-h" className="data-card__title">
            Download a backup
          </h2>
          <p>
            One file with every recipe, photo you kept, collection and tag. Keep it somewhere safe — email it to yourself or save it to cloud storage. You can restore it here or in any
            browser.
          </p>
          <p className="data-card__meta">
            {recipes.length} recipes, {collections.length} collections.{' '}
            {lastBackup ? `Last backup ${lastBackup.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.` : 'No backup downloaded yet.'}
          </p>
          <Button variant="primary" icon={<Download size={18} />} onClick={exportBackup} disabled={recipes.length === 0 && collections.length === 0}>
            Download backup
          </Button>
        </section>

        <section className="data-card data-card--sky" aria-labelledby="restore-h">
          <Upload size={24} aria-hidden="true" className="data-card__icon" />
          <h2 id="restore-h" className="data-card__title">
            Restore from a backup
          </h2>
          <p>Bring recipes back from a backup file. You’ll see what’s inside and choose how to handle recipes you already have before anything changes.</p>
          <label className="btn btn--secondary btn--md file-btn" htmlFor={fileId}>
            <span className="btn__icon" aria-hidden="true">
              <Upload size={18} />
            </span>
            <span className="btn__label">Choose backup file</span>
          </label>
          <input
            id={fileId}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void readBackup(f);
            }}
          />
          {restoreError && (
            <p className="field__error" role="alert">
              {restoreError}
            </p>
          )}
        </section>

        <section className="data-card data-card--mint" aria-labelledby="keep-h">
          <HardDrive size={24} aria-hidden="true" className="data-card__icon" />
          <h2 id="keep-h" className="data-card__title">
            Storage on this device
          </h2>
          <p>
            Browsers can clear site data when a device runs low on space, and clearing your browsing data deletes it too. Asking for persistent storage makes that much less likely.
          </p>
          {estimate && estimate.quota > 0 && (
            <p className="data-card__meta">
              Using {formatBytes(estimate.usage)} of the {formatBytes(estimate.quota)} this browser allows.
            </p>
          )}
          {persisted ? (
            <p className="data-card__ok">
              <ShieldCheck size={18} aria-hidden="true" /> This browser has agreed to keep your recipes.
            </p>
          ) : storageApi && typeof storageApi.persist === 'function' ? (
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await storageApi.persist().catch(() => false);
                setPersisted(ok);
                if (ok) toast.success('Your browser will keep your recipes.');
                else toast.info('Your browser didn’t agree this time — it decides based on how often you use the site. Regular backups are the safest bet.');
              }}
            >
              Ask the browser to keep my recipes
            </Button>
          ) : null}
        </section>
      </div>

      <section className="privacy" aria-labelledby="privacy-h">
        <h2 id="privacy-h" className="section-title">
          How your data is handled
        </h2>
        <dl className="privacy__list">
          <div>
            <dt>Where recipes live</dt>
            <dd>In this browser’s storage (IndexedDB) on this device. There’s no account and no server. Another browser or device won’t see them until you restore a backup there.</dd>
          </div>
          <div>
            <dt>Not encrypted</dt>
            <dd>Browser storage isn’t encrypted or password-protected. Anyone who can use this browser profile can open your recipes, so keep private recipes off shared computers.</dd>
          </div>
          <div>
            <dt>Imports stay on the device</dt>
            <dd>
              Photos, PDFs and documents are read in memory on this device — text recognition runs locally — and nothing is uploaded to an AI service. The original file and the raw text are thrown away after import.
              Only the recipe you save is kept, plus a photo if you choose to keep one.
            </dd>
          </div>
          <div>
            <dt>Links</dt>
            <dd>When you import a link, your browser asks that website for the page directly, the same as visiting it. We don’t route it through anyone else, which is why some sites can’t be imported.</dd>
          </div>
          <div>
            <dt>No tracking</dt>
            <dd>No analytics, ads or third-party trackers. Recipe content is never sent in error reports.</dd>
          </div>
          <div>
            <dt>Sharing</dt>
            <dd>There are no public recipe links. Sharing sends a text copy of the recipe through your device’s share sheet or clipboard.</dd>
          </div>
        </dl>
        <p className="privacy__future">
          <Server size={16} aria-hidden="true" />
          <span>Backups use a documented, versioned format, so they can be imported into a future synced version of Let Her Cook without losing anything.</span>
        </p>
      </section>

      <section className="danger-zone" aria-labelledby="danger-h">
        <h2 id="danger-h" className="section-title section-title--small">
          Start over
        </h2>
        <p>Delete every recipe, collection and setting from this browser. Download a backup first if you might want them back.</p>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setClearOpen(true)} disabled={recipes.length === 0 && collections.length === 0}>
          Delete everything
        </Button>
      </section>

      <Dialog
        open={!!preview}
        onClose={() => !importing && setPreview(null)}
        dismissible={!importing}
        title="Restore this backup?"
        description={
          preview && (
            <p>
              {preview.exportedAt ? `Made on ${new Date(preview.exportedAt).toLocaleString()}. ` : ''}It has {preview.recipes.length} recipes and {preview.collections.length} collections.
            </p>
          )
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={importing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runImport} disabled={importing || !preview || (preview.recipes.length === 0 && preview.collections.length === 0)}>
              {importing ? 'Restoring…' : 'Restore'}
            </Button>
          </>
        }
      >
        {preview && (
          <>
            {(preview.invalidRecipes > 0 || preview.invalidCollections > 0) && (
              <p className="inline-warning">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  {preview.invalidRecipes + preview.invalidCollections} damaged {preview.invalidRecipes + preview.invalidCollections === 1 ? 'entry' : 'entries'} can’t be read and will be
                  skipped.
                </span>
              </p>
            )}
            {dupCount > 0 ? (
              <fieldset className="field">
                <legend className="field__label">
                  {dupCount} {dupCount === 1 ? 'recipe is' : 'recipes are'} already in your library. What should we do?
                </legend>
                <div className="radio-list">
                  {(Object.keys(STRATEGY_COPY) as DuplicateStrategy[]).map((s) => (
                    <label key={s} className="radio-item">
                      <input type="radio" name="dup" value={s} checked={strategy === s} onChange={() => setStrategy(s)} />
                      <span>
                        <strong>{STRATEGY_COPY[s].label}</strong>
                        <span className="radio-item__hint">{STRATEGY_COPY[s].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="muted">None of these recipes are in your library yet, so they’ll all be added. Nothing you have now will change.</p>
            )}
            <p className="field__hint">Collections with the same name are merged.</p>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Delete everything?"
        description={
          <p>
            This permanently removes all {recipes.length} recipes and {collections.length} collections from this browser. It can’t be undone unless you have a backup.
          </p>
        }
        confirmLabel="Delete everything"
        danger
        onConfirm={async () => {
          try {
            await repo.clearAll();
            setClearOpen(false);
            toast.success('Everything was deleted from this browser.');
          } catch (err) {
            toast.error(storageErrorMessage(err));
          }
        }}
      />
    </div>
  );
}
