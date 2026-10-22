import { NextResponse, type NextRequest } from "next/server";
import { invoiceFilename, renderInvoicePdf } from "@/lib/invoice/pdf";
import { loadOrderDocument } from "@/lib/orders/document";
import { createClient } from "@/lib/supabase/server";

/** PDF invoice download. Owner or admin only (decided by RLS on the first read). */
export async function GET(request: NextRequest, { params }: RouteContext<"/account/orders/[id]/invoice">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visible } = await supabase.from("orders").select("id,invoice_number").eq("id", id).maybeSingle();
  if (!visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!visible.invoice_number) return NextResponse.json({ error: "No invoice yet: it is issued once the order is paid." }, { status: 404 });

  const doc = await loadOrderDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderInvoicePdf(doc);
  const disposition = request.nextUrl.searchParams.has("download") ? "attachment" : "inline";

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${invoiceFilename(visible.invoice_number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
