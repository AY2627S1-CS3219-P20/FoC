import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "react-toastify";

import { Field, FieldError, FieldGroup, FieldLabel, FieldContent } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ImageUploadField from "@/features/supplier/components/ImageUploadField";
import {
  supplierFormSchema,
  supplierDayValues,
  supplierDayLabels,
  SUPPLIER_TYPES,
  type SupplierFormValues,
} from "@/features/supplier/schemas/supplier.schema";
import type { Supplier, SupplierDay } from "@/types/api.types";

interface OpeningHourRow {
  day: SupplierDay;
  openingTime: string;
  closingTime: string;
}

const inputBaseClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm";

const formatTime = (value: string | Date | undefined | null): string => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

interface SupplierFormProps {
  initialData?: Supplier;
  submitLabel: string;
  isPending?: boolean;
  onSubmit: (values: SupplierFormValues, openingHours: OpeningHourRow[]) => void;
  onCancel: () => void;
}

const SupplierForm = ({
  initialData,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: SupplierFormProps) => {
  const [openHours, setOpenHours] = useState<OpeningHourRow[]>(
    initialData?.openingHours && initialData.openingHours.length > 0
      ? initialData.openingHours.map((hour) => ({
          day: hour.day,
          openingTime: formatTime(hour.openingTime),
          closingTime: formatTime(hour.closingTime),
        }))
      : [],
  );

  const form = useForm({
    defaultValues: {
      name: initialData?.name ?? "",
      type: initialData?.type ?? "",
      description: initialData?.description ?? "",
      address: initialData?.address ?? "",
      building: initialData?.building ?? "",
      floor: initialData?.floor != null ? String(initialData.floor) : "",
      latitude: initialData?.latitude != null ? String(initialData.latitude) : "",
      longitude: initialData?.longitude != null ? String(initialData.longitude) : "",
      imageUrl: initialData?.imageUrl ?? "",
    },
    validators: {
      onSubmit: supplierFormSchema,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value as SupplierFormValues, openHours);
    },
  });

  const updateHour = (index: number, key: keyof OpeningHourRow, value: string) => {
    setOpenHours((hours) => {
      if (key === "day") {
        const already = hours.some((hour, i) => i !== index && hour.day === value);
        if (already) {
          toast.error("Opening hours cannot have duplicate days");
          return hours;
        }
      }
      return hours.map((hour, i) =>
        i === index ? { ...hour, [key]: value } : hour,
      );
    });
  };

  const addHour = () => {
    setOpenHours((hours) => [...hours, { day: "FRIDAY", openingTime: "", closingTime: "" }]);
  };

  const removeHour = (index: number) => {
    setOpenHours((hours) => hours.filter((_, i) => i !== index));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <FieldContent>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="e.g. Star Bucks Kent Ridge"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </FieldContent>
              </Field>
            );
          }}
        </form.Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="type">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Supplier Type</FieldLabel>
                  <FieldContent>
                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      className={`${inputBaseClass} cursor-pointer appearance-none pr-8`}
                    >
                      <option value="">Select a supplier type</option>
                      {SUPPLIER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="address">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 21 Lower Kent Ridge Rd"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="building">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Building</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="floor">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Floor</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={0}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="latitude">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Latitude</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      step="any"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="longitude">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Longitude</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      step="any"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <form.Field name="description">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="Describe what the supplier offers"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </FieldContent>
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="imageUrl">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Location Image (Optional)</FieldLabel>
                <FieldContent>
                  <ImageUploadField
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </FieldContent>
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Opening Hours (Optional)</FieldLabel>
        </div>
        {openHours.map((hour, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">Day</label>
                <select
                  value={hour.day}
                  onChange={(e) => updateHour(index, "day", e.target.value as SupplierDay)}
                  className={`${inputBaseClass} cursor-pointer appearance-none pr-8`}
                >
                  {supplierDayValues.map((day) => (
                    <option key={day} value={day}>
                      {supplierDayLabels[day]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-1 gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Opens</label>
                  <input
                    type="time"
                    value={hour.openingTime}
                    onChange={(e) => updateHour(index, "openingTime", e.target.value)}
                    className={`${inputBaseClass} [color-scheme:none]`}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Closes</label>
                  <input
                    type="time"
                    value={hour.closingTime}
                    onChange={(e) => updateHour(index, "closingTime", e.target.value)}
                    className={`${inputBaseClass} [color-scheme:none]`}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={() => removeHour(index)}
                aria-label="Remove opening hour"
                className="shrink-0"
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addHour} className="self-start">
          <PlusIcon />
          Add opening hour
        </Button>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="indigo" size="lg" isLoading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default SupplierForm;
