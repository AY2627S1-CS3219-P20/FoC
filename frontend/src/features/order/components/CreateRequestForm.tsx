import { useForm } from "@tanstack/react-form";
import { createRequestSchema, type CreateRequestFormData } from "@/features/order/schemas/create-request.schema";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import SupplierSelect from "./SupplierSelect";
import useCreateRequest from "@/features/order/hooks/useCreateRequest";
import DateTimePicker from "./DateTimePicker";

interface CreateRequestFormProps {
    onCancel: () => void;
}

const CreateRequestForm = ({ onCancel }: CreateRequestFormProps) => {
    const { createRequest, isPending } = useCreateRequest();

    const form = useForm({
        defaultValues: {
            name: "",
            description: "",
            pickupSupplierId: "",
            deliverySupplierId: "",
            offeredCredits: "",
            expiryAt: "",
            remarks: "",
        },
        validators: {
            onSubmit: createRequestSchema,
        },
        onSubmit: async ({ value }) => {
            const parsedData: CreateRequestFormData = createRequestSchema.parse(value);
            createRequest(parsedData);
            onCancel();
        },
    });

    return (
        <>
            <form
                onSubmit={e => {
                    e.preventDefault();
                    form.handleSubmit();
                }}
                className="flex flex-col gap-4 w-full">
                <FieldGroup>
                    <form.Field
                        name="name"
                        children={field => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Request Name</FieldLabel>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={e => field.handleChange(e.target.value)}
                                        aria-invalid={isInvalid}
                                        placeholder="e.g. Buy coffee"
                                    />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    <form.Field
                        name="description"
                        children={field => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                                    <Textarea
                                        id={field.name}
                                        name={field.name}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={e => field.handleChange(e.target.value)}
                                        aria-invalid={isInvalid}
                                        placeholder="Desribe your request here"
                                    />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    <div className="flex w-full flex-col md:flex-row gap-5">
                        <form.Field
                            name="pickupSupplierId"
                            children={field => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className="min-w-0 flex-1">
                                        <FieldLabel htmlFor={field.name}>Pickup Location</FieldLabel>
                                        <SupplierSelect
                                            value={field.state.value}
                                            isInvalid={isInvalid}
                                            onChange={field.handleChange}
                                            placeholder="Select pickup location"
                                        />
                                        {isInvalid && (<FieldError errors={field.state.meta.errors} />)}
                                    </Field>
                                );
                            }}
                        />
                        <form.Field
                            name="deliverySupplierId"
                            children={field => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className="min-w-0 flex-1">
                                        <FieldLabel htmlFor={field.name}>Delivery Location</FieldLabel>
                                        <SupplierSelect
                                            value={field.state.value}
                                            isInvalid={isInvalid}
                                            onChange={field.handleChange}
                                            placeholder="Select delivery location"
                                        />
                                        {isInvalid && (<FieldError errors={field.state.meta.errors} />)}
                                    </Field>
                                );
                            }}
                        />
                    </div>
                    <div className="flex w-full flex-col md:flex-row gap-5">
                        <form.Field
                            name="offeredCredits"
                            children={field => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Offered Credits</FieldLabel>
                                        <Input
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={e => field.handleChange(e.target.value.trim())}
                                            aria-invalid={isInvalid}
                                            type="number"
                                            placeholder="e.g. 10"
                                        />
                                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                    </Field>
                                );
                            }}
                        />
                        <form.Field
                            name="expiryAt"
                            children={field => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Expiry Date and Time</FieldLabel>
                                        <DateTimePicker
                                            value={field.state.value}
                                            isInvalid={isInvalid}
                                            onChange={field.handleChange}
                                            onBlur={field.handleBlur}
                                            placeholder="Select expiry date and time"
                                        />
                                        {isInvalid && (<FieldError errors={field.state.meta.errors} />)}
                                    </Field>
                                );
                            }}
                        />
                    </div>
                    <form.Field
                        name="remarks"
                        children={field => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Remarks</FieldLabel>
                                    <Textarea
                                        id={field.name}
                                        name={field.name}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={e => field.handleChange(e.target.value)}
                                        aria-invalid={isInvalid}
                                        placeholder="Optional remarks for your request"
                                    />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                </FieldGroup>
                <div className="flex flex-row gap-3 items-center justify-end">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="w-fit"
                        variant="indigo"
                        isLoading={isPending}
                    >
                        Submit Request
                    </Button>
                </div>
            </form>
        </>
    );
}

export default CreateRequestForm;