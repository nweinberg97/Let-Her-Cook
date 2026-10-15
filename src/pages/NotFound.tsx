import { ButtonLink } from '../components/ui/Button';
import { usePageTitle } from '../lib/usePageTitle';

export function NotFound({ what = 'page' }: { what?: 'page' | 'recipe' | 'collection' }) {
  usePageTitle('Not found');
  return (
    <div className="page">
      <div className="empty">
        <h1 className="empty__title">
          {what === 'recipe' ? 'We can’t find that recipe' : what === 'collection' ? 'We can’t find that collection' : 'We can’t find that page'}
        </h1>
        <p className="empty__text">
          {what === 'page' ? 'The link may be mistyped.' : 'It may have been deleted, or it was saved in a different browser. Recipes live in the browser they were saved in.'}
        </p>
        <ButtonLink to="/" variant="primary">
          Go to my recipes
        </ButtonLink>
      </div>
    </div>
  );
}
