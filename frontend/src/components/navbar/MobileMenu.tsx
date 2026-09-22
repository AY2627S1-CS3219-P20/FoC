import { Link, useLocation } from "react-router-dom";

import {
    BoxesIcon,
    ClipboardListIcon,
    CoinsIcon,
    HouseIcon,
    LogOutIcon,
    MenuIcon,
    UserIcon,
} from "lucide-react";

import useAuth from "@/hooks/useAuth";
import useLogout from "@/hooks/useLogout";

import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuLink,
} from "@/components/ui/navigation-menu";

import CreditBalance from "./CreditBalance";
import { useState } from "react";

const MobileMenu = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { logout } = useLogout();

    const [open, setOpen] = useState(false);

    if (!user) {
        return null;
    }

    return (
        <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
            <DrawerTrigger render={<Button variant="ghost" size="icon-lg" />}>
                <MenuIcon />
            </DrawerTrigger>

            <DrawerContent>
                <DrawerHeader>
                    <div className="flex items-center justify-between gap-4">
                        <span className="block min-w-0 truncate text-lg font-semibold text-indigo-500">
                            {user.username}
                        </span>
                        <DrawerClose render={<Button variant="ghost" size="icon-lg" />} >
                            <MenuIcon />
                        </DrawerClose>
                    </div>
                </DrawerHeader>

                <div className="flex flex-col gap-2 p-4">
                    <CreditBalance />

                    <Separator className="bg-slate-300" />

                    <NavigationMenu className="max-w-full">
                        <NavigationMenuList>
                            <ul className="flex w-full flex-col gap-1">
                                <li>
                                    <NavigationMenuLink
                                        active={location.pathname === "/home"}
                                        render={
                                            <Link
                                                to="/home"
                                                onClick={() => setOpen(false)}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <HouseIcon className="size-5" />
                                                Home
                                            </Link>
                                        }
                                    />
                                </li>
                                <li>
                                    <NavigationMenuLink
                                        active={location.pathname === "/activity"}
                                        render={
                                            <Link
                                                to="/activity"
                                                onClick={() => setOpen(false)}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <ClipboardListIcon className="size-5" />
                                                Activity
                                            </Link>
                                        }
                                    />
                                </li>
                                <li>
                                    <NavigationMenuLink
                                        active={location.pathname === "/suppliers"}
                                        render={
                                            <Link
                                                to="/suppliers"
                                                onClick={() => setOpen(false)}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <BoxesIcon className="size-5" />
                                                Suppliers
                                            </Link>
                                        }
                                    />
                                </li>
                                <li>
                                    <NavigationMenuLink
                                        active={location.pathname === "/credits"}
                                        render={
                                            <Link
                                                to="/credits"
                                                onClick={() => setOpen(false)}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <CoinsIcon className="size-5" />
                                                Credits
                                            </Link>
                                        }
                                    />
                                </li>
                            </ul>
                        </NavigationMenuList>
                    </NavigationMenu>

                    <Separator className="bg-slate-300" />

                    <NavigationMenu className="max-w-full">
                        <NavigationMenuList>
                            <ul className="flex w-full flex-col gap-1">
                                <li>
                                    <NavigationMenuLink
                                        active={location.pathname === "/profile"}
                                        render={
                                            <Link
                                                to="/profile"
                                                onClick={() => setOpen(false)}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <UserIcon className="size-5" />
                                                Profile
                                            </Link>
                                        }
                                    />
                                </li>
                                <li>
                                    <NavigationMenuLink
                                        onClick={() => { logout(); setOpen(false); }}
                                        className="flex cursor-pointer items-center gap-2 text-red-600"
                                    >
                                        <LogOutIcon className="size-5" />
                                        Logout
                                    </NavigationMenuLink>
                                </li>

                            </ul>
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

export default MobileMenu;