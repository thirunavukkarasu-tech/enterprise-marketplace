import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ChevronLeft, Save } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchCategories } from '../../features/catalog/categorySlice';
import { productApi } from '../../features/catalog/productApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { FormField } from '../../components/common/FormField';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import type { Product, ProductVariant } from '../../types/catalog';

const detailsFormSchema = z.object({
  title: z.string().trim().min(3, 'At least 3 characters').max(150),
  description: z.string().trim().max(5000),
  category: z.string().min(1, 'Select a category'),
  status: z.enum(['draft', 'active', 'archived']),
});

const newVariantSchema = z.object({
  sku: z.string().trim().min(2, 'Required').max(40),
  optionLabel: z.string().trim().max(60),
  price: z.coerce.number().min(0, 'Must be 0 or more'),
  stock: z.coerce.number().int().min(0, 'Must be 0 or more'),
});

const createFormSchema = detailsFormSchema.extend({
  variants: z.array(newVariantSchema).min(1, 'At least one variant is required'),
});

type DetailsForm = z.infer<typeof detailsFormSchema>;
type CreateForm = z.infer<typeof createFormSchema>;

/**
 * A product's core details and its variants are two different backend
 * resources (PATCH /products/manage/:id vs the /variants sub-routes), so
 * in edit mode this form mirrors that split: the details card saves on
 * its own submit, and each variant row saves/deletes independently
 * through the real variant endpoints — not a single mega-form pretending
 * they're one write. On create, the product doesn't exist yet, so the
 * initial variant set is still submitted together with the product.
 */
export function VendorProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const categories = useAppSelector((state) => state.categories.items);

  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'failed'>(isEditing ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    dispatch(fetchCategories({}));
  }, [dispatch]);

  useEffect(() => {
    if (!id) return;
    productApi
      .getManagedById(id)
      .then((p) => {
        setProduct(p);
        setLoadStatus('ready');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setLoadError(anyErr.response?.data?.message ?? 'Failed to load this product.');
        setLoadStatus('failed');
      });
  }, [id]);

  if (loadStatus === 'loading') {
    return (
      <div className="flex justify-center p-16">
        <Spinner />
      </div>
    );
  }

  if (loadStatus === 'failed') {
    return (
      <div className="p-8">
        <ErrorState message={loadError ?? 'Failed to load this product.'} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to="/vendor/products" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <ChevronLeft size={15} /> Back to products
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">{isEditing ? 'Edit product' : 'New product'}</h1>

      {isEditing && product ? (
        <EditProductForm product={product} onProductChange={setProduct} serverError={serverError} setServerError={setServerError} />
      ) : (
        <CreateProductForm categories={categories} navigate={navigate} setServerError={setServerError} serverError={serverError} />
      )}
    </div>
  );
}

// ── Create mode: details + initial variant batch, submitted together ────

function CreateProductForm({
  categories,
  navigate,
  serverError,
  setServerError,
}: {
  categories: { _id: string; name: string }[];
  navigate: ReturnType<typeof useNavigate>;
  serverError: string | null;
  setServerError: (msg: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      status: 'draft',
      variants: [{ sku: '', optionLabel: '', price: 0, stock: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  const onSubmit = async (values: CreateForm) => {
    setServerError(null);
    try {
      await productApi.create({
        title: values.title,
        description: values.description,
        category: values.category,
        status: values.status,
        variants: values.variants.map((v) => ({
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          attributes: v.optionLabel ? ({ option: v.optionLabel } as Record<string, string>) : {},
        })),
      });
      navigate('/vendor/products');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Failed to create product. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardBody className="flex flex-col gap-4 p-5">
          <FormField label="Title" htmlFor="title">
            <Input id="title" error={errors.title?.message} {...register('title')} />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <textarea
              id="description"
              rows={4}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-ink focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              {...register('description')}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category" htmlFor="category">
              <select id="category" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink" {...register('category')}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-coral-600">{errors.category.message}</p>}
            </FormField>
            <FormField label="Status" htmlFor="status">
              <select id="status" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink" {...register('status')}>
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (published)</option>
                <option value="archived">Archived</option>
              </select>
            </FormField>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Variants &amp; SKUs</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => append({ sku: '', optionLabel: '', price: 0, stock: 0 })}>
            <Plus size={14} /> Add variant
          </Button>
        </CardHeader>
        <CardBody className="flex flex-col gap-4 p-5">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_100px_100px_auto] items-end gap-2">
              <FormField label="SKU" htmlFor={`variants.${index}.sku`}>
                <Input id={`variants.${index}.sku`} error={errors.variants?.[index]?.sku?.message} {...register(`variants.${index}.sku` as const)} />
              </FormField>
              <FormField label="Option (e.g. Size M)" htmlFor={`variants.${index}.optionLabel`}>
                <Input id={`variants.${index}.optionLabel`} {...register(`variants.${index}.optionLabel` as const)} />
              </FormField>
              <FormField label="Price" htmlFor={`variants.${index}.price`}>
                <Input id={`variants.${index}.price`} type="number" step="0.01" error={errors.variants?.[index]?.price?.message} {...register(`variants.${index}.price` as const)} />
              </FormField>
              <FormField label="Stock" htmlFor={`variants.${index}.stock`}>
                <Input id={`variants.${index}.stock`} type="number" error={errors.variants?.[index]?.stock?.message} {...register(`variants.${index}.stock` as const)} />
              </FormField>
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  <Trash2 size={14} className="text-coral-600" />
                </Button>
              )}
            </div>
          ))}
          {errors.variants?.root?.message && <p className="text-xs text-coral-600">{errors.variants.root.message}</p>}
        </CardBody>
      </Card>

      {serverError && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create product'}
        </Button>
        <Link to="/vendor/products">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

// ── Edit mode: details form + independently-persisted variant rows ─────

function EditProductForm({
  product,
  onProductChange,
  serverError,
  setServerError,
}: {
  product: Product;
  onProductChange: (p: Product) => void;
  serverError: string | null;
  setServerError: (msg: string | null) => void;
}) {
  const navigate = useNavigate();
  const categories = useAppSelector((state) => state.categories.items);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DetailsForm>({
    resolver: zodResolver(detailsFormSchema),
    defaultValues: {
      title: product.title,
      description: product.description,
      category: product.category._id,
      status: product.status,
    },
  });

  const onSubmitDetails = async (values: DetailsForm) => {
    setServerError(null);
    try {
      const updated = await productApi.update(product._id, values);
      onProductChange(updated);
      navigate('/vendor/products');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Failed to save product. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmitDetails)} noValidate>
        <Card>
          <CardBody className="flex flex-col gap-4 p-5">
            <FormField label="Title" htmlFor="title">
              <Input id="title" error={errors.title?.message} {...register('title')} />
            </FormField>
            <FormField label="Description" htmlFor="description">
              <textarea
                id="description"
                rows={4}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-ink focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                {...register('description')}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Category" htmlFor="category">
                <select id="category" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink" {...register('category')}>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status" htmlFor="status">
                <select id="status" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink" {...register('status')}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="active">Active (published)</option>
                  <option value="archived">Archived</option>
                </select>
              </FormField>
            </div>

            {serverError && (
              <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
                {serverError}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save details'}
              </Button>
              <Link to="/vendor/products">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Variants &amp; SKUs</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 p-5">
          {product.variants.map((variant) => (
            <VariantRow
              key={variant._id}
              productId={product._id}
              variant={variant}
              canRemove={product.variants.length > 1}
              onChange={(updated) => onProductChange(updated)}
            />
          ))}
          <AddVariantRow productId={product._id} onAdded={(updated) => onProductChange(updated)} />
        </CardBody>
      </Card>
    </div>
  );
}

function VariantRow({
  productId,
  variant,
  canRemove,
  onChange,
}: {
  productId: string;
  variant: ProductVariant;
  canRemove: boolean;
  onChange: (product: Product) => void;
}) {
  const [price, setPrice] = useState(variant.price);
  const [stock, setStock] = useState(variant.stock);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = price !== variant.price || stock !== variant.stock;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await productApi.updateVariant(productId, variant._id, { price, stock });
      onChange(updated);
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to update variant.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await productApi.removeVariant(productId, variant._id);
      onChange(updated);
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to remove variant.');
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="grid grid-cols-[1fr_100px_100px_auto_auto] items-end gap-2">
        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">SKU (fixed)</p>
          <p className="font-mono text-sm text-ink">{variant.sku}</p>
        </div>
        <FormField label="Price" htmlFor={`price-${variant._id}`}>
          <Input
            id={`price-${variant._id}`}
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </FormField>
        <FormField label="Stock" htmlFor={`stock-${variant._id}`}>
          <Input id={`stock-${variant._id}`} type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </FormField>
        <Button type="button" size="sm" variant="secondary" disabled={!dirty || saving} onClick={handleSave}>
          <Save size={14} /> Save
        </Button>
        {canRemove && (
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={handleRemove}>
            <Trash2 size={14} className="text-coral-600" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate">Available: {variant.availableStock}</p>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}

function AddVariantRow({ productId, onAdded }: { productId: string; onAdded: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [optionLabel, setOptionLabel] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start">
        <Plus size={14} /> Add variant
      </Button>
    );
  }

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await productApi.addVariant(productId, {
        sku,
        price,
        stock,
        attributes: optionLabel ? { option: optionLabel } : {},
      });
      onAdded(updated);
      setOpen(false);
      setSku('');
      setOptionLabel('');
      setPrice(0);
      setStock(0);
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to add variant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed border-slate-200 p-3">
      <div className="grid grid-cols-[1fr_1fr_100px_100px_auto] items-end gap-2">
        <FormField label="SKU" htmlFor="new-sku">
          <Input id="new-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </FormField>
        <FormField label="Option" htmlFor="new-option">
          <Input id="new-option" value={optionLabel} onChange={(e) => setOptionLabel(e.target.value)} />
        </FormField>
        <FormField label="Price" htmlFor="new-price">
          <Input id="new-price" type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </FormField>
        <FormField label="Stock" htmlFor="new-stock">
          <Input id="new-stock" type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </FormField>
        <Button type="button" size="sm" disabled={saving || sku.length < 2} onClick={handleAdd}>
          Add
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
