export const CATEGORIES = [
  "Audio",
  "Laptops",
  "Phones & Tablets",
  "Wearables",
  "Smart Home",
  "Kitchen",
  "Outdoor",
  "Fitness",
  "Office",
] as const;

export type Category = (typeof CATEGORIES)[number];
