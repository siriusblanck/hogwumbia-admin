"use client";
import { usePathname } from "next/navigation";
import PageSkeleton from "./page-skeleton";
export default function RouteLoading() {
  return <PageSkeleton pathname={usePathname()} />;
}
