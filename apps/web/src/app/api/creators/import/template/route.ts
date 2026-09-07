import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsonError, requireApiUser } from "@/lib/api-utils";

const HEADERS = [
  "Name",
  "Gender",
  "Country",
  "City",
  "Creator Type",
  "Niche",
  "Phone",
  "Email",
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "Facebook",
  "LinkedIn",
  "Snapchat",
  "Twitch",
];

const EXAMPLE_ROWS = [
  {
    Name: "Sara Ahmed",
    Gender: "Female",
    Country: "Egypt",
    City: "Cairo",
    "Creator Type": "Blogger",
    Niche: "Fashion, Beauty",
    Phone: "1001234567",
    Email: "sara@example.com",
    Instagram: "https://instagram.com/sara.ahmed",
    TikTok: "@sara.ahmed",
    YouTube: "",
    X: "",
    Facebook: "",
    LinkedIn: "",
    Snapchat: "",
    Twitch: "",
  },
  {
    Name: "Omar Hany",
    Gender: "Male",
    Country: "Egypt",
    City: "Giza",
    "Creator Type": "YouTuber",
    Niche: "Tech",
    Phone: "1007654321",
    Email: "omar@example.com",
    Instagram: "",
    TikTok: "",
    YouTube: "@omar.hany",
    X: "https://x.com/omarhany",
    Facebook: "",
    LinkedIn: "",
    Snapchat: "",
    Twitch: "",
  },
];

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can download the import template.", 403);

  const sheet = XLSX.utils.json_to_sheet(EXAMPLE_ROWS, { header: HEADERS });
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 30 },
    { wch: 26 },
    { wch: 26 },
    { wch: 22 },
    { wch: 26 },
    { wch: 26 },
    { wch: 18 },
    { wch: 16 },
  ];

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Field", "Notes"],
    ["Name (required)", "The creator's full name."],
    ["Gender (required)", "One of the gender options configured in Workspace Settings."],
    ["Country", "Must match a country in Workspace Settings (its dial code prefixes the phone)."],
    ["City", "Must belong to the chosen Country."],
    ["Creator Type", "Must match a creator type configured in Workspace Settings."],
    ["Niche", "Comma-separated values; must come from the configured niche options."],
    ["Phone", "Digits only, no dial code — the country dial code is added automatically."],
    ["Email", "Optional; must be unique per creator."],
    ["Platform columns", "Instagram / TikTok / YouTube / X / Facebook / LinkedIn / Snapchat / Twitch. Entries accept @handle or a full link, one per column."],
    ["", "Duplicate rows (same handle, email or phone) are skipped automatically."],
  ]);
  instructions["!cols"] = [{ wch: 22 }, { wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Creators");
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="creators-import-template.xlsx"',
    },
  });
}