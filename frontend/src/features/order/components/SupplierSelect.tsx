import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import type { Supplier } from "@/types/api.types";
import { cn } from "cn";
import { useAllActiveSuppliers } from "../hooks/useAllActiveSuppliers";

interface SupplierSelectProps {
    value: string;
    isInvalid?: boolean;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    displayName?: string;
    className?: string;
}

const SupplierSelect = ({
    value,
    isInvalid,
    onChange,
    placeholder = "Select supplier",
    disabled = false,
    displayName,
    className,
}: SupplierSelectProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    // Fetch all active suppliers
    const suppliersQuery = useAllActiveSuppliers();
    const suppliers = suppliersQuery.data ?? [];

    // Search suppliers based on the search input
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filteredSuppliers = suppliers.filter((supplier) =>
        supplier.name
            .toLocaleLowerCase()
            .includes(normalizedSearch),
    );

    // Determine the selected supplier's name to display in the button
    const selectedName =
        selectedSupplier?.id === value
            ? selectedSupplier.name
            : displayName;


    const handleSelect = (supplier: Supplier) => {
        onChange(supplier.id);
        setSelectedSupplier(supplier);
        setOpen(false);
        setSearch("");
    };

    return (
        <Popover
            open={!disabled && open}
            onOpenChange={(nextOpen) => {
                if (!disabled) setOpen(nextOpen);
            }}>
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        variant="input"
                        role="combobox"
                        disabled={disabled}
                        aria-expanded={!disabled && open}
                        aria-invalid={isInvalid}
                        className={cn(
                            "w-full min-w-0 justify-between text-left font-normal",
                            !selectedName && "text-muted-foreground", className
                        )}
                    >
                        <span className="min-w-0 flex-1 truncate text-left">
                            {selectedName ?? placeholder}
                        </span>

                        {!disabled && (
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        )}
                    </Button>
                }
            />

            <PopoverContent
                align="start"
                className="w-[var(--anchor-width)] min-w-[var(--anchor-width)] max-w-[var(--anchor-width)] max-h-[40vh] overflow-hidden p-0"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search suppliers..."
                        value={search}
                        onValueChange={setSearch}
                    />

                    <CommandList className="max-h-[calc(40vh-100px)] overflow-y-auto">
                        {suppliersQuery.isLoading && (
                            <CommandEmpty>Loading suppliers...</CommandEmpty>
                        )}

                        {suppliersQuery.isError && (
                            <CommandEmpty>Could not load suppliers.</CommandEmpty>
                        )}

                        {!suppliersQuery.isLoading &&
                            !suppliersQuery.isError &&
                            filteredSuppliers.length === 0 && (
                                <CommandEmpty>No suppliers found.</CommandEmpty>
                            )}

                        <CommandGroup>
                            {filteredSuppliers.map((supplier) => (
                                <CommandItem
                                    key={supplier.id}
                                    value={supplier.name}
                                    onSelect={() => handleSelect(supplier)}
                                >
                                    <Check
                                        className={`
                                            mr-2 h-4 w-4,
                                            ${value === supplier.id
                                                ? "opacity-100"
                                                : "opacity-0"}
                                        `}
                                    />

                                    <div className="flex flex-col gap-1">
                                        <span className="text-wrap leading-none">
                                            {supplier.name}
                                        </span>

                                        <span className="text-xs text-muted-foreground">
                                            {supplier.type}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default SupplierSelect;