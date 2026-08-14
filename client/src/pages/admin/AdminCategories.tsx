import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, FolderTree, Trash2, X } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { categoryApi } from '../../features/catalog/categoryApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';

const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  parent: z.string().optional(),
});

type CategoryForm = z.infer<typeof categoryFormSchema>;

export function AdminCategories() {
  const { categories, status, error, refetch } = useCategories({ managed: true });
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({ resolver: zodResolver(categoryFormSchema) });

  const onSubmit = async (values: CategoryForm) => {
    setServerError(null);
    try {
      await categoryApi.create({
        name: values.name,
        description: values.description || undefined,
        parent: values.parent || null,
      });
      reset();
      setShowForm(false);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Could not create this category.');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setRowError(null);
    try {
      await categoryApi.update(id, { isActive: !isActive });
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setRowError(anyErr.response?.data?.message ?? 'Could not update this category.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This only works if it has no subcategories or products.`)) return;
    setRowError(null);
    try {
      await categoryApi.remove(id);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setRowError(anyErr.response?.data?.message ?? 'Could not delete this category.');
    }
  };

  const parentName = (parentId: string | null) => categories.find((c) => c._id === parentId)?.name;

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-slate">Organize the marketplace catalog.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New category'}
        </Button>
      </header>

      {showForm && (
        <Card className="mb-6">
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-3">
              <FormField label="Name" htmlFor="name">
                <Input id="name" error={errors.name?.message} {...register('name')} />
              </FormField>
              <FormField label="Parent (optional)" htmlFor="parent">
                <select id="parent" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...register('parent')}>
                  <option value="">None (top-level)</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Description (optional)" htmlFor="description">
                <Input id="description" {...register('description')} />
              </FormField>
              {serverError && (
                <p className="col-span-full rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{serverError}</p>
              )}
              <div className="col-span-full flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create category'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {rowError && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{rowError}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && categories.length === 0 && (
        <EmptyState icon={FolderTree} title="No categories yet" description="Create one to start organizing products." />
      )}

      {status === 'success' && categories.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categories.map((category) => (
                <tr key={category._id}>
                  <td className="px-4 py-3 font-medium text-ink">{category.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{parentName(category.parent) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={category.isActive ? 'emerald' : 'neutral'}>
                      {category.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(category._id, category.isActive)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-ink-soft hover:bg-slate-100"
                      >
                        {category.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category._id, category.name)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-coral-600 hover:bg-coral-100"
                        aria-label="Delete category"
                      >
                        <Trash2 size={14} />
                      </button>
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
