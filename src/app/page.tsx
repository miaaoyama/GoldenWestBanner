// src/app/page.tsx — redirects to the static index.html (Team-13 dashboard)
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/index.html");
}
