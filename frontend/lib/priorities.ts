import {
  Tag,
  Star,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { PriorityId } from "./types";

export interface PriorityConfig {
  id: PriorityId;
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  accent: string; // hex used for glow / highlight
}

export const PRIORITIES: PriorityConfig[] = [
  {
    id: "lowest_price",
    label: "Lowest Price",
    description: "Cheapest deal across all retailers",
    icon: Tag,
    badge: "Best Price",
    accent: "#53C89B",
  },
  {
    id: "best_rating",
    label: "Best Rating",
    description: "Highest quality & trust score",
    icon: Star,
    badge: "Top Rated",
    accent: "#FFB7D5",
  },
  {
    id: "best_warranty",
    label: "Best Warranty",
    description: "Strongest protection & returns",
    icon: ShieldCheck,
    badge: "Best Warranty",
    accent: "#7C6CFF",
  },
  {
    id: "fastest_delivery",
    label: "Fastest Delivery",
    description: "Arrives at your door first",
    icon: Truck,
    badge: "Fastest",
    accent: "#72DDF7",
  },
];

export function getPriority(id: string): PriorityConfig {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[0];
}
