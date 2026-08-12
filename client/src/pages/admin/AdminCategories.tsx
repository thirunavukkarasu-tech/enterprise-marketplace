import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchCategories, categoriesInvalidated } from '../../features/catalog/categorySlice';
import { categoryApi } from '../../features/catalog/categoryApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

export function AdminCategories() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((state) => state.categories);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => dispatch(fetchCategories({ includeInactive: true }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await categoryApi.create({ name: name.trim() });
      setName('');
      dispatch(categoriesInvalidated());
      load();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setFormError(anyErr.response?.data?.message ?? 'Failed to create category.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? This fails if it still has products or subcategories.')) return;
    setDeletingId(id);
    try {
      await categoryApi.remove(id);
      dispatch(categoriesInvalidated());
      load();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      alert(anyErr.response?.data?.message ?? 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-slate">Manage the categories vendors list products under.</p>
      </header>

      <Card className="mb-6">
        <form onSubmit={handleCreate} className="flex items-end gap-3 p-5">
          <div className="flex-1">
            <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium text-ink-soft">
              New category name
            </label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home & Living" />
          </div>
          <Button type="submit" disabled={creating}>
            <Plus size={15} /> {creating ? 'Adding…' : 'Add category'}
          </Button>
        </form>
        {formError && <p className="px-5 pb-4 text-sm text-coral-600">{formError}</p>}
      </Card>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'failed' && <ErrorState message={error ?? 'Failed to load categories.'} onRetry={load} />}

      {status === 'succeeded' && items.length === 0 && <EmptyState title="No categories yet" />}

      {status === 'succeeded' && items.length > 0 && (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{category.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate">{category.slug}</td>
                  <td className="px-4 py-3">
                    <span className={category.isActive ? 'text-emerald-600' : 'text-slate'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === category._id}
                        onClick={() => handleDelete(category._id)}
                      >
                        <Trash2 size={14} className="text-coral-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
