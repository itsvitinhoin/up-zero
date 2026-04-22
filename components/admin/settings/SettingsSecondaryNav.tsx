"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  anchor: string;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  groups: NavGroup[];
}

function SettingsNavItem({
  item,
  groupHref,
  isActive,
  isGroupActive,
  onAnchorClick,
}: {
  item: NavItem;
  groupHref: string;
  isActive: boolean;
  isGroupActive: boolean;
  onAnchorClick: (anchor: string) => void;
}) {
  return (
    <li>
      <Link
        href={`${groupHref}#${item.anchor}`}
        onClick={(e) => {
          if (isGroupActive) {
            e.preventDefault();
            onAnchorClick(item.anchor);
          }
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-colors duration-150",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "h-[5px] w-[5px] shrink-0 rounded-full transition-colors duration-150",
            isActive ? "bg-primary" : "bg-border"
          )}
        />
        {item.label}
      </Link>
    </li>
  );
}

function SettingsNavGroup({
  group,
  isActive,
  activeAnchor,
  onAnchorClick,
}: {
  group: NavGroup;
  isActive: boolean;
  activeAnchor: string;
  onAnchorClick: (anchor: string) => void;
}) {
  const Icon = group.icon;
  const hasItems = group.items.length > 0;
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    setIsOpen(isActive);
  }, [isActive]);

  if (!hasItems) {
    return (
      <Link
        href={group.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted/50"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-150",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span className="flex-1">{group.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-xl transition-colors duration-150",
          "hover:bg-muted/50"
        )}
      >
        <Link
          href={group.href}
          className={cn(
            "flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
            isActive ? "text-primary" : "text-foreground"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-150",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
          {group.label}
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
          aria-label={isOpen ? "Recolher" : "Expandir"}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        </button>
      </div>

      <div
        className="overflow-hidden"
        style={{
          maxHeight: isOpen ? "800px" : "0px",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 0.28s ease-in-out, opacity 0.2s ease-in-out",
        }}
      >
        <ul className="mb-1.5 ml-3 mt-0.5 space-y-0.5 border-l border-border/40 pl-3">
          {group.items.map((item) => (
            <SettingsNavItem
              key={item.anchor}
              item={item}
              groupHref={group.href}
              isActive={isActive && activeAnchor === item.anchor}
              isGroupActive={isActive}
              onAnchorClick={onAnchorClick}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SettingsNavSection({
  section,
  currentPage,
  activeAnchor,
  onAnchorClick,
}: {
  section: NavSection;
  currentPage: string;
  activeAnchor: string;
  onAnchorClick: (anchor: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
        {section.title}
      </p>
      {section.groups.map((group) => (
        <SettingsNavGroup
          key={group.key}
          group={group}
          isActive={currentPage === group.key}
          activeAnchor={activeAnchor}
          onAnchorClick={onAnchorClick}
        />
      ))}
    </div>
  );
}

interface SettingsSecondaryNavProps {
  sections: NavSection[];
  currentPage: string;
  activeAnchor: string;
  onAnchorClick: (anchor: string) => void;
}

export function SettingsSecondaryNav({
  sections,
  currentPage,
  activeAnchor,
  onAnchorClick,
}: SettingsSecondaryNavProps) {
  return (
    <nav aria-label="Navegação de configurações" className="select-none space-y-5">
      {sections.map((section) => (
        <SettingsNavSection
          key={section.title}
          section={section}
          currentPage={currentPage}
          activeAnchor={activeAnchor}
          onAnchorClick={onAnchorClick}
        />
      ))}
    </nav>
  );
}
