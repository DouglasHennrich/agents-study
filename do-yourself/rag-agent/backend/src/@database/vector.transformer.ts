import { ValueTransformer } from "typeorm";

export const vectorTransformer: ValueTransformer = {
  to(value: number[] | null): string | null {
    if (value === null || value === undefined) return null;
    return `[${value.join(",")}]`;
  },
  from(value: string | null): number[] | null {
    if (value === null || value === undefined) return null;
    return value.replace(/^\[/, "").replace(/\]$/, "").split(",").map(Number);
  },
};
