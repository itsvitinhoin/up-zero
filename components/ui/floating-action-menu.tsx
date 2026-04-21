"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type FloatingActionMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  className?: string;
  triggerLabel?: string;
  align?: "end" | "center";
};

const FloatingActionMenu = ({ options, className, triggerLabel, align = "end" }: FloatingActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 rounded-full bg-[#111111cc] hover:bg-[#111111ee] shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
          triggerLabel ? "px-5 gap-2 text-sm font-semibold" : "w-14 p-0"
        )}
      >
        {triggerLabel && <span>{triggerLabel}</span>}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          <ChevronUp className={cn(triggerLabel ? "w-4 h-4" : "w-7 h-7")} />
        </motion.div>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "absolute bottom-16 mb-2",
              align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"
            )}
          >
            <div className={cn("flex flex-col gap-2", align === "center" ? "items-center" : "items-end")}>
              {options.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <Button
                    onClick={() => { option.onClick(); setIsOpen(false); }}
                    className="flex items-center gap-2.5 h-11 px-5 bg-[#111111cc] hover:bg-[#111111ee] shadow-[0_4px_24px_rgba(0,0,0,0.35)] border-none rounded-2xl backdrop-blur-sm text-sm font-medium whitespace-nowrap"
                  >
                    {option.Icon}
                    <span>{option.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingActionMenu;
