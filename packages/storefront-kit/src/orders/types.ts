import type { OrderStatus } from "@ecomweb/sdk";

export const STATUS_OPTIONS: { label: string; value: "all" | OrderStatus }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Chờ xử lý", value: "pending" },
  { label: "Đã xác nhận", value: "confirmed" },
  { label: "Đang xử lý", value: "processing" },
  { label: "Tạm giữ", value: "on_hold" },
  { label: "Đã hủy", value: "cancelled" },
  { label: "Đã hoàn thành", value: "completed" },
];
