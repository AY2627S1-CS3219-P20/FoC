import useSuppliers from "@/features/suppliers/hooks/useSuppliers";
import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import SupplierRecordCard from "@/features/suppliers/components/SupplierRecordCard";

const SupplierPage = () => {
    const DEFAULT_PAGE = 1;
    const { data: suppliers, isLoading, isError, error } = useSuppliers(DEFAULT_PAGE);
    // console.log(suppliers)
    // console.log("type:", typeof suppliers?.data, "isArray:", Array.isArray(suppliers?.data), suppliers?.data);

    return (
        <>
            <div className="flex flex-col items-start justify-center gap-5 px-5 md:px-10 py-5">
                <h1 className="text-xl md:text-2xl font-bold">Suppliers</h1>
                {/* TODO: fetch all the supplier types and do a loop, such that each element is in the menubar*/}
                <Menubar className="w-fit">
                    <MenubarMenu>
                        <MenubarTrigger>All</MenubarTrigger>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Food</MenubarTrigger>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Retail</MenubarTrigger>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Facilities</MenubarTrigger>
                    </MenubarMenu>
                </Menubar>
                {isLoading && <p>Loading suppliers...</p>}
                {isError && <p>Failed to load suppliers: {error.message}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {suppliers?.data?.map(supplier => <SupplierRecordCard supplier={supplier} key={supplier.id} /> )}
                </div>
            </div>
        </>
    );
};

export default SupplierPage;
