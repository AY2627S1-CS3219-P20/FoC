import { NavLink } from "react-router-dom";
import type { NavLinkItem } from "./navLinks";

interface DesktopNavProps {
    links: NavLinkItem[];
}

const DesktopNav = ({ links }: DesktopNavProps) => {
    return (
        <nav className="hidden items-center space-x-8 md:flex">
            {links.map(({ label, href }) => (
                <NavLink
                    key={href}
                    to={href}
                    className={({ isActive }) =>
                        `text-sm font-medium text-center ${isActive
                            ? "text-zinc-800"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`
                    }
                >
                    {label}
                </NavLink>
            ))}
        </nav>
    );
};

export default DesktopNav;