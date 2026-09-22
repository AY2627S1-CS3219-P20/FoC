import { Card } from "@/components/ui/card";
import type { SupplierRecord } from "@/types/api.types";
import { Map, MapPin } from "lucide-react";

interface SupplierRecordProps {
    supplier: SupplierRecord;
}

const SupplierRecordCard = ({supplier}: SupplierRecordProps) => {
    console.log(supplier.imageUrl)
    return (
        <>
            <Card className="w-[300px] h-auto gap-0 p-3 flex flex-col drop-shadow-sm transition duration-100 ease-in-out hover:scale-105">
                <div className="flex flex-row"> 
                    <img 
                        src={supplier.imageUrl}
                        alt="location image"
                        width="115px"
                        height="100px"
                    />
                    <div className="flex flex-col justify-center">
                        <h2 className="text-base font-bold text-ellipsis overflow-hidden">{supplier.name}</h2>
                        <p className="text-xs text-gray-400 text-ellipsis overflow-hidden">{supplier.description}</p>
                    </div>
                </div>
                <div className="flex flex-row items-center">
                    <MapPin className="w-[24px] mr-2"/>
                    <p className="text-xs">{supplier.address}</p>
                </div>
                <div className="flex flex-row items-center">
                    <Map className="w-[24px] mr-2" />
                    <p className="text-xs">Floor {supplier.floor}, {supplier.building}</p>
                </div>
            </Card>
        </>
    )
}

export default SupplierRecordCard;
