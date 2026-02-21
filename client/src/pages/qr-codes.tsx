import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, QrCode, Store, Table } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { useAuth } from "@/lib/auth";
import type { Table as TableType } from "@shared/schema";

export default function QRCodesPage() {
  const { t, direction, getLocalizedName } = useLanguage();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId || "default";

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: tables, isLoading } = useQuery<TableType[]>({
    queryKey: [`/api/tables${branchParam}`],
  });

  const { data: restaurant } = useQuery<{ nameEn?: string; nameAr?: string; slug?: string }>({
    queryKey: ["/api/restaurant"],
  });

  const { data: allBranches } = useQuery<{ id: string; slug?: string; name: string }[]>({
    queryKey: ["/api/branches"],
  });

  const baseUrl = window.location.origin;
  const restaurantSlug = (restaurant as any)?.slug || restaurantId;
  const branchSlug = selectedBranchId && allBranches
    ? (allBranches.find(b => b.id === selectedBranchId)?.slug || selectedBranchId)
    : selectedBranchId;

  const downloadQR = (tableNumber: string, tableId: string) => {
    const svg = document.getElementById(`qr-table-${tableId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 30, 300, 300);
        ctx.fillStyle = "black";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${t("tableNumber")} ${tableNumber}`, 200, 380);
        ctx.font = "18px Arial";
        ctx.fillText(t("scanToOrder"), 200, 420);
      }

      const link = document.createElement("a");
      link.download = `table-${tableNumber}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadGeneralQR = () => {
    const svg = document.getElementById("qr-general");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 30, 300, 300);
        ctx.fillStyle = "black";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        const name = getLocalizedName(restaurant?.nameEn, restaurant?.nameAr) || "Restaurant";
        ctx.fillText(name, 200, 380);
        ctx.font = "18px Arial";
        ctx.fillText(t("scanToOrder"), 200, 420);
      }

      const link = document.createElement("a");
      link.download = "general-menu-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir={direction}>
        <div className="flex items-center gap-3">
          <QrCode className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-bold">{t("qrCodesManagement")}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-48 w-48 mx-auto" />
                <Skeleton className="h-6 w-24 mx-auto mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir={direction}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <QrCode className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{t("qrCodesManagement")}</h1>
        </div>
      </div>

      <Card data-testid="card-general-qr">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-general-qr-title">
            <Store className="h-5 w-5" />
            {t("generalMenuQR")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-lg" data-testid="qr-preview-general">
            <QRCodeSVG
              id="qr-general"
              value={`${baseUrl}/m/${restaurantSlug}${branchSlug ? `?b=${branchSlug}` : ""}`}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all select-all bg-muted/50 rounded px-3 py-2 max-w-xs" dir="ltr">
            {`${baseUrl}/m/${restaurantSlug}${branchSlug ? `?b=${branchSlug}` : ""}`}
          </p>
          <p className="text-sm text-muted-foreground text-center" data-testid="text-browse-menu-hint">
            {t("browseMenu")}
          </p>
          <Button
            data-testid="button-download-general-qr"
            onClick={downloadGeneralQR}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t("downloadQR")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2" data-testid="text-table-qr-section">
          <Table className="h-5 w-5" />
          {t("tableQR")}
        </h2>

        {!tables || tables.length === 0 ? (
          <Card data-testid="card-no-tables">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-tables">{t("noTables")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table) => (
              <Card key={table.id} data-testid={`card-table-qr-${table.id}`}>
                <CardContent className="p-4 flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-lg" data-testid={`qr-preview-table-${table.id}`}>
                    <QRCodeSVG
                      id={`qr-table-${table.id}`}
                      value={`${baseUrl}/m/${restaurantSlug}/table/${table.id}${branchSlug ? `?b=${branchSlug}` : ""}`}
                      size={160}
                      level="H"
                      includeMargin
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <Badge variant="secondary" className="text-lg" data-testid={`badge-table-number-${table.id}`}>
                      {t("tableNumber")} {table.tableNumber}
                    </Badge>
                    <p className="text-xs text-muted-foreground break-all select-all bg-muted/50 rounded px-2 py-1 max-w-[200px]" dir="ltr">
                      {`${baseUrl}/m/${restaurantSlug}/table/${table.id}${branchSlug ? `?b=${branchSlug}` : ""}`}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-table-capacity-${table.id}`}>
                      {table.capacity} {t("guests")}
                      {table.location && ` • ${table.location}`}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <Button
                      data-testid={`button-download-qr-${table.id}`}
                      size="sm"
                      onClick={() => downloadQR(table.tableNumber, table.id)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      {t("downloadQR")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
