// If this component is resued, can move it src/features/credit/components/CreditBalance.tsx in the future.

const CreditBalance = () => {
    return (
        <div className="flex w-fit flex-col items-start justify-center pr-3">
            <span className="text-sm font-semibold">
                Available Credits{" "}
                {/* {isLoading ? "—" : data?.availableCredits ?? 0} */}
            </span>

            <span className="text-xs text-muted-foreground">
                Reserved Credits{" "}
                {/* {isLoading ? "—" : data?.reservedCredits ?? 0} */}
            </span>
        </div>
    );
};

export default CreditBalance;