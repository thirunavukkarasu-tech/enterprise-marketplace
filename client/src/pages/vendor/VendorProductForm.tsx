import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { useCategories } from '../../hooks/useCategories';
import { productApi } from '../../features/catalog/productApi';

const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers, and hyphens only'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  compareAtPrice: z.number().positive().optional(),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
});

const productFormSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  category: z.string().min(1, 'Category is required'),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
});

type ProductForm = z.infer<typeof productFormSchema>;

const emptyVariant = { sku: '', price: 0, compareAtPrice: undefined, stock: 0 };

export function VendorProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { title: '', description: '', category: '', variants: [emptyVariant] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  useEffect(() => {
    if (!id) return;
    productApi
      .getManagedById(id)
      .then((product) => {
        reset({
          title: product.title,
          description: product.description,
          category: typeof product.category === 'string' ? product.category : product.category._id,
          variants: product.variants.map((v) => ({
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stock: v.stock,
          })),
        });
      })
      .catch(() => setServerError('Could not load this product.'))
      .finally(() => setLoadingExisting(false));
  }, [id, reset]);

  const onSubmit = async (values: ProductForm) => {
    setServerError(null);
    try {
      const payload = {
        title: values.title,
        description: values.description,
        category: values.category,
        variants: values.variants.map((v) => ({
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
        })),
      };
      if (isEdit && id) {
        await productApi.update(id, { title: payload.title, description: payload.description, category: payload.category });
      } else {
        await productApi.create(payload);
      }
      navigate('/vendor/products', { replace: true });
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Could not save this product.');
    }
  };

  if (loadingExisting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to="/vendor/products" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <ChevronLeft size={16} /> Back to products
      </Link>

      <h1 className="mb-6 text-2xl font-semibold">{isEdit ? 'Edit product' : 'New product'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <FormField label="Title" htmlFor="title">
              <Input id="title" error={errors.title?.message} {...register('title')} />
            </FormField>

            <FormField label="Description" htmlFor="description">
              <textarea
                id="description"
                rows={4}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                {...register('description')}
              />
              {errors.description?.message && <p className="text-xs text-coral-600">{errors.description.message}</p>}
            </FormField>

            <FormField label="Category" htmlFor="category">
              <select
                id="category"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                {...register('category')}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category?.message && <p className="text-xs text-coral-600">{errors.category.message}</p>}
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-medium">Variants</h2>
            {!isEdit && (
              <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyVariant)}>
                <Plus size={14} /> Add variant
              </Button>
            )}
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {isEdit && (
              <p className="text-xs text-slate">
                Variants are managed separately once a product exists — edit stock and pricing per-SKU from the
                product list.
              </p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 border-b border-slate-100 pb-4 last:border-0">
                <FormField label="SKU" htmlFor={`variants.${index}.sku`}>
                  <Input
                    id={`variants.${index}.sku`}
                    disabled={isEdit}
                    error={errors.variants?.[index]?.sku?.message}
                    {...register(`variants.${index}.sku` as const)}
                  />
                </FormField>
                <FormField label="Price" htmlFor={`variants.${index}.price`}>
                  <Input
                    id={`variants.${index}.price`}
                    type="number"
                    step="0.01"
                    disabled={isEdit}
                    error={errors.variants?.[index]?.price?.message}
                    {...register(`variants.${index}.price` as const)}
                  />
                </FormField>
                <FormField label="Stock" htmlFor={`variants.${index}.stock`}>
                  <Input
                    id={`variants.${index}.stock`}
                    type="number"
                    disabled={isEdit}
                    error={errors.variants?.[index]?.stock?.message}
                    {...register(`variants.${index}.stock` as const)}
                  />
                </FormField>
                {!isEdit && fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-coral-600 hover:bg-coral-100"
                    aria-label="Remove variant"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {errors.variants?.message && <p className="text-xs text-coral-600">{errors.variants.message}</p>}
          </CardBody>
        </Card>

        {serverError && <p className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{serverError}</p>}

        <div className="flex justify-end gap-3">
          <Link to="/vendor/products">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
