export type SortOption = "newest" | "oldest" | "az" | "za";

export const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "A-Z", value: "az" },
  { label: "Z-A", value: "za" },
];

type SortableTimestamps = {
  created?: string;
  updated?: string;
};

export function getPocketBaseSort(sort: SortOption, titleField = "title") {
  switch (sort) {
    case "oldest":
      return "created";
    case "az":
      return titleField;
    case "za":
      return `-${titleField}`;
    case "newest":
    default:
      return "-created";
  }
}

export function sortByOption<T>(
  rows: T[],
  sort: SortOption,
  getTitle: (row: T) => string,
) {
  return [...rows].sort((left, right) => {
    if (sort === "az" || sort === "za") {
      const comparison = getTitle(left).localeCompare(getTitle(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sort === "az" ? comparison : -comparison;
    }

    const leftTimestamps = left as SortableTimestamps;
    const rightTimestamps = right as SortableTimestamps;
    const leftTime = new Date(
      leftTimestamps.created ?? leftTimestamps.updated ?? 0,
    ).getTime();
    const rightTime = new Date(
      rightTimestamps.created ?? rightTimestamps.updated ?? 0,
    ).getTime();
    return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}
