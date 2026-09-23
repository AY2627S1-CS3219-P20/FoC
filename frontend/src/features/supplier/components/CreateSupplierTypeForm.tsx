import { useMutation } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { toast } from "react-toastify";
import { supplierTypeFormSchema } from "../schemas/supplier.schema";
import { createSupplierType } from "@/api/supplierApi";
import type { ParsedError } from "@/utils/errorHandler";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateSupplierTypeFormProps {
    submitLabel: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const CreateSupplierTypeForm = ({ submitLabel, onSuccess, onCancel }: CreateSupplierTypeFormProps) => {
    const { mutate, isPending, isError, error } = useMutation({
        mutationFn: createSupplierType,
        onSuccess: () => {
            toast.success("Supplier type created");
            onSuccess();
        },
        onError: (error: ParsedError) => {
            toast.error(error.message);
        },
    });

    const form = useForm({
        defaultValues: {
            type: '',
        },
        validators: {
            onSubmit: supplierTypeFormSchema,
        },
        onSubmit: async ({ value }) => {
            mutate(value.type);
        }
    });

    return (
        <div className="bg-white w-2/3 px-5 py-5 rounded-xl border-xs">
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    form.handleSubmit()
                }}
                className="flex flex-col gap-5"
            >
                <FieldGroup>
                    <form.Field name="type">
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
                                    placeholder="Enter new supplier type"
                                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                                />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </FieldContent>
                            </Field>
                            );
                        }}
                    </form.Field>
                </FieldGroup>

                <div className="flex items-center justify-end gap-3 flex-col sm:flex-row">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="indigo" size="lg" isLoading={isPending}>
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default CreateSupplierTypeForm;