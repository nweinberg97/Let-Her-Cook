import { useState } from 'react';
import { Copy, Share2, Download, Check } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { recipeToPlainText } from '../../lib/export/plainText';
import { downloadFile, safeFileName } from '../../lib/export/download';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export function ShareDialog({ recipe, servings, open, onClose }: { recipe: Recipe; servings: number | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const text = recipeToPlainText(recipe, servings);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Recipe copied. Paste it into a text, email or note.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Your browser blocked copying. Select the text below and copy it yourself.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: recipe.title, text, ...(recipe.sourceUrl ? { url: recipe.sourceUrl } : {}) });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') toast.error('Sharing didn’t work here. Copy the recipe instead.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share this recipe"
      description={
        <p>
          Your recipes live only in this browser, so there’s no link to send. Share it as text instead — whoever receives it can paste it into their own Let Her Cook.
        </p>
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="share-actions">
        {canShare && (
          <Button variant="primary" icon={<Share2 size={18} />} onClick={share}>
            Share…
          </Button>
        )}
        <Button variant={canShare ? 'secondary' : 'primary'} icon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={copy}>
          {copied ? 'Copied' : 'Copy recipe'}
        </Button>
        <Button variant="secondary" icon={<Download size={18} />} onClick={() => downloadFile(text, `${safeFileName(recipe.title)}.txt`, 'text/plain;charset=utf-8')}>
          Download .txt
        </Button>
      </div>
      <label className="field__label" htmlFor="share-preview">
        Preview
      </label>
      <textarea id="share-preview" className="textarea share-preview" readOnly value={text} rows={10} />
    </Dialog>
  );
}
