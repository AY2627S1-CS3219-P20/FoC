import { NavLink } from "react-router-dom";

const DesktopNav = () => {
    return (
        <nav className="hidden md:flex items-center space-x-8">
            <NavLink
                to="/home"
                className={({ isActive }) =>
                    `text-sm font-medium ${isActive
                        ? "text-zinc-800"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`
                }
            >
                Home
            </NavLink>

            <NavLink
                to="/activity"
                className={({ isActive }) =>
                    `text-sm font-medium ${isActive
                        ? "text-zinc-800"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`
                }
            >
                Activity
            </NavLink>

            <NavLink
                to="/suppliers"
                className={({ isActive }) =>
                    `text-sm font-medium ${isActive
                        ? "text-zinc-800"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`
                }
            >
                Suppliers
            </NavLink>

            <NavLink
                to="/credits"
                className={({ isActive }) =>
                    `text-sm font-medium ${isActive
                        ? "text-zinc-800"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`
                }
            >
                Credits
            </NavLink>
        </nav>
    );
};

export default DesktopNav;